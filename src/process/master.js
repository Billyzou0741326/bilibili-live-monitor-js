(function() {

    'use strict';

    const cluster = require('cluster');

    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    const RoomCollector = require('../danmu/roomcollector.js');
    const AbstractMaster = require('./abstractmaster.js');
    const History = require('../handler/history.js');
    const Database = require('../db/database.js');
    const config = require('../global/config.js');
    const { sleep } = require('../util/utils.js');
    const {
        GIFT,
        FIXED,
        DYNAMIC_1,
        DYNAMIC_2, } = config;

    class Master extends AbstractMaster {

        constructor() {
            super();

            this.workers = {};                  // { String : WorkerManager }
            this.workers[GIFT] = null;
            this.workers[FIXED] = null;
            this.workers[DYNAMIC_1] = null;
            // this.workers[DYNAMIC_2] = null;

            this.dynamicListUpdateWaiter1 = () => {};
            // this.dynamicListUpdateWaiter2 = () => {};
            this.fixedRooms = new Set();
            this.history = new History();
            this.db = new Database('record.json');
            this.roomCollector = new RoomCollector(this.db);
            this.running = false;

            this.masterSettings = { 'windowsHide': true };
            cluster.setupMaster(this.masterSettings);
            cluster.on('message', this.onMessage);
            cluster.on('exit', this.onExit);
        }

        bind() {
            super.bind();
            this.onExit = this.onExit.bind(this);
        }

        run() {
            if (this.running === false) {
                this.running = true;

                this.history.run();
                this.db.run();

                // spawns worker processes
                this.createProcesses();

                (async () => {
                    // wait for workers to go online, setup static and dynamic monitor
                    const raffleSetupTask = this.setupRaffle();
                    const fixedSetupTask = this.setupFixed();
                    await fixedSetupTask;
                    await raffleSetupTask;

                    // update dynamic rooms about every 2 minutes
                    const twoMinutes = 1000 * 60 * 2;
                    while (this.running === true) {
                        await this.setupDynamic();
                        await sleep(twoMinutes);
                    }
                })();
            }
        }

        onExit(worker, code, signal) {
            const id = super.onExit(worker, code, signal);
            if (this.running === true) {
                const type = this.getNameById(id);
                if (type) {
                    const env = {
                        'type': type,
                        'verbose': config.verbose,
                    };
                    this.workers[type] = null;
                    this.workers[type] = this.fork(type, env);
                }
            }
        }

        // Forks worker processes to carry out tasks
        createProcesses() {
            Object.keys(this.workers).forEach(type => {
                const env = {
                    'type': type,
                    'verbose': config.verbose,
                };
                this.workers[type] = this.fork(type, env);
            });
        }

        // @returns     Promise -> undefined
        setupFixed() {
            let setup = (async () => {
                const list = await this.roomCollector.getFixedRooms();
                const fixedWorkerManager = this.workers[FIXED];
                const fixedWorker = fixedWorkerManager.getWorker();
                const data = {
                    'cmd': 'update_rooms',
                    'from': 'master',
                    'to': FIXED,
                    'data': list,
                };
                await fixedWorkerManager.waitOnline();
                fixedWorker.send(data);
                this.fixedRooms = new Set([].concat(list));  // copy一下吧
            })();
            return setup;
        }

        // @returns     Promise -> undefined
        setupDynamic() {
            let setup = (async () => {
                // 同步执行动态房间获取与worker返回等待
                const getDynamicTask = this.roomCollector.getDynamicRooms();

                // immediately start waiting for worker response
                const responseWaiter1 = new Promise(resolve => {
                    this.dynamicListUpdateWaiter1 = resolve;
                });

                // send query to worker
                const dynamicWorkerMng1 = this.workers[DYNAMIC_1];
                const dynamicWorker1 = dynamicWorkerMng1.getWorker();
                await dynamicWorkerMng1.waitOnline();
                dynamicWorker1.send({ 'cmd': 'get_rooms' });

                // wait for worker send back established rooms  ( onMessage resolves )
                const establishedRooms = await (
                    Promise.all([ responseWaiter1, ])
                    .then(nestedList => {
                        const ls1 = nestedList[0].length;
                        cprint(`[ 动态 ] Monitoring ${ls1} rooms`, colors.green);
                        return nestedList;
                    })
                    .then(nestedList => new Set([].concat(nestedList))));

                // filter out established rooms and fixed rooms
                let newDynamicRooms = await getDynamicTask;
                const originalSize = newDynamicRooms.length;
                newDynamicRooms = (newDynamicRooms
                    .filter(room => establishedRooms.has(room) === false)
                    .filter(room => this.fixedRooms.has(room) === false));
                const filteredSize = newDynamicRooms.length;
                if (config.verbose === true)
                    cprint(`Filtered out ${originalSize-filteredSize} rooms`, colors.green);

                /** split the remaining valid rooms
                const middle = Number.parseInt(newDynamicRooms.length / 2);
                const list1 = newDynamicRooms.slice(0, middle);
                const list2 = newDynamicRooms.slice(middle, newDynamicRooms.length);
                // */

                dynamicWorker1.send({ 'cmd': 'update_rooms', 'data': newDynamicRooms });

            })();

            return setup;
        }

        setupRaffle() {
            // raffle worker will get its own rooms and self update on close
        }

        onMessage(worker, msg) {
            const cmd = msg['cmd'];
            const from = msg['from'];
            const to = msg['to'];
            const data = msg['data'];
            let giftType = '';

            switch (cmd) {

                case 'guard':
                    // fall through
                case 'gift':
                    // fall through
                case 'pk':
                    // fall through
                case 'storm':
                    giftType = cmd;
                    if (this.history.isUnique(giftType, data)) {
                        const { id, roomid, name, type, expireAt } = data;
                        const giftData = { id, roomid, name, type, expireAt };
                        this.history.addGift(giftData);
                        this.emit(giftType, giftData);
                        this.printGift(giftType, giftData);
                    }
                    break;

                case 'established_rooms':
                    // setupDynamic response arrives
                    if (from === DYNAMIC_1) {
                        this.dynamicListUpdateWaiter1(data);
                    }
                    break;

                case 'add_fixed':
                    // add dynamic room to fixed
                    {
                        const roomid = msg['data'];
                        const fixedWorker = this.workers[FIXED].getWorker();
                        this.fixedRooms.add(roomid);
                        const response = {};
                        response['cmd'] = 'update_rooms';
                        response['from'] = 'master';
                        response['to'] = FIXED;
                        response['data'] = [ roomid ];
                        cprint(`Adding @${roomid} to fixed`, colors.green);
                        fixedWorker && fixedWorker.send(response);
                    }
                    // fall through
                case 'add_to_db':
                    {
                        const roomid = msg['data'];
                        this.db.add(roomid);
                    }
                    break;
            }
        }

        printGift(type, gift) {
            // perhaps binary comparison is faster than string comparison
            const mapping = {
                'gift':  0b0001,
                'guard': 0b0010,
                'pk':    0b0100,
                'storm': 0b1000,
            };

            let giftText = '';

            switch (mapping[type]) {
                case 0b0001:
                    // gift
                    // fall through
                case 0b0010:
                    // guard
                    // fall through
                case 0b0100:
                    // pk
                    giftText = `${gift['id'].toString().padEnd(13)}`
                        + `@${gift['roomid'].toString().padEnd(13)}`
                        + `${gift['type'].padEnd(13)}`
                        + `${gift['name']}`;
                    break;

                case 0b1000:
                    // storm
                    giftText = `${gift['id'].toString().slice(0,7).padEnd(13)}`
                        + `@${gift['roomid'].toString().padEnd(13)}`
                        + `${gift['type'].padEnd(13)}`
                        + `${gift['name'].padEnd(13)}`
                        + `${gift['id']}`;
                    break;
                default:
                    return null;
            }
            cprint(giftText, colors.cyan);
        }
    }

    module.exports = Master;

})();
