/** Messaging agreement
 *
 *  {
 *      'cmd': '',      // String
 *      'from': '',     // String   'master' | 'gift' | 'fixed' | 'dynamic'
 *      'data': any,
 *  }
 */

(function() {

    'use strict';

    const os = require('os');
    const cluster = require('cluster');
    const EventEmitter = require('events').EventEmitter;

    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    const History = require('../handler/history.js');
    const Database = require('../db/database.js');

    const Bilibili = require('../bilibili.js');

    class Master extends EventEmitter {

        constructor() {
            super();
            this.workerOfType = {
                'gift': null,       // workerid
                'fixed': null,
                'dynamic': null,
            };
            this.typeOfWorker = new Map();  // id => ('gift' || 'fixed' || 'dynamic')

            this.typeRestartedTimes = {
                'gift': 0,
                'fixed': 0,
                'dynamic': 0,
            };

            this.history = new History();
            this.db = new Database('record.json');
            this.running = false;

            this.fixedRooms = new Set();
            this.fixedEstablished = false;
            this.dynamicTask = null;

            this.bind();
        }

        run() {
            if (cluster.isMaster === false) {
                throw new Error('Run worker as Master is forbiddened');
            }

            if (this.running === false) {

                this.running = true;

                this.history.run();
                this.db.run();

                cluster.on('exit', this.onExit);
                cluster.on('message', this.onMessage);
                cluster.on('disconnect', this.onDisconnect);

                this.createProcesses();
            }
        }

        stop() {
            if (this.running === true) {
                this.running = false;
                Object.entries(cluster.workers).forEach((wid, worker) => {
                    worker.send({ 'cmd': 'close' });
                });
            }
        }

        bind() {
            this.onExit = this.onExit.bind(this);
            this.onMessage = this.onMessage.bind(this);
            this.onDisconnect = this.onDisconnect.bind(this);
            this.onWorkerOnline = this.onWorkerOnline.bind(this);
        }

        createProcesses() {

            Object.keys(this.workerOfType).forEach(type => {
                const env = { 'type': type };
                const worker = cluster.fork(env);

                worker.on('online', this.onWorkerOnline(type));
                this.typeOfWorker.set(worker.id, type);
                this.workerOfType[type] = worker;
            });

        }

        onOnline(worker) {
        }

        onWorkerOnline(type) {
            return () => {
                cprint(`${type.toUpperCase()} worker online`, colors.green);
            };
        }

        onDisconnect(worker) {
        }

        onExit(worker, code, signal) {
            const type = this.typeOfWorker.get(worker.id);
            this.typeOfWorker.delete(worker.id);
            cprint(`${type.toUpperCase()} worker exited with status ${code}`, colors.yellow);

            ++this.typeRestartedTimes[type];
            const failedTimes = this.typeRestartedTimes;
            if (failedTimes > 10) {
                cprint(`${type.toUpperCase()} process failed ${failedTimes} times`, colors.red);
                cprint(`Program terminating`, colors.red);
                this.stop();
                process.exit(1);
            }

            if (this.running === true) {
                const env = { 'type': type };
                const worker = cluster.fork(env);

                worker.on('online', this.onWorkerOnline(type));
                this.typeOfWorker.set(worker.id, type);
                this.workerOfType[type] = worker;
            }
        }

        onMessage(worker, msg, handle) {
            let data = {};
            switch (msg['cmd']) {
                case 'gift':
                    // fall through
                case 'guard':
                    // fall through
                case 'pk':
                    const giftType = msg['cmd'];
                    if (this.history.isUnique(giftType, msg['data'])) {
                        const giftData = msg['data'];
                        this.printGift(giftType, giftData);
                        this.emit(giftType, giftData);
                        this.history.addGift(giftData);
                    }
                    break;
                case 'storm':
                    const storm = msg['data'];
                    this.printGift('storm', storm);
                    this.emit('storm', storm);
                    break;
                case 'add_fixed':
                    const roomid = msg['data'];
                    const fixedWorker = this.workerOfType['fixed'];
                    this.fixedRooms.add(roomid);
                    data['cmd'] = 'update_rooms';
                    data['from'] = 'master';
                    data['to'] = this.typeOfWorker.get(fixedWorker.id);
                    data['data'] = [ roomid ];
                    cprint(`Adding @${roomid} to fixed`, colors.green);
                    fixedWorker && fixedWorker.send(data);
                    // fall through
                case 'add_to_db':
                    this.db.add(roomid);
                    break;
                case 'get_gift_rooms':
                    // Worker get its own
                    break;
                case 'get_fixed_rooms':
                    data['cmd'] = 'update_rooms';
                    data['from'] = 'master';
                    data['to'] = this.typeOfWorker.get(worker.id);
                    this.collectRooms('fixed').then(result => {
                        const list = this.fixedRooms = new Set(result['fixed']);
                        data['data'] = Array.from(list);
                        worker.send(data);
                    }).then(() => {
                        this.fixedEstablished = true;
                        this.dynamicTask && this.dynamicTask();
                        this.dynamicTask = null;
                    });
                    break;
                case 'get_dynamic_rooms':
                    this.dynamicTask = () => {
                        data['cmd'] = 'update_rooms';
                        data['from'] = 'master';
                        data['to'] = this.typeOfWorker.get(worker.id);
                        this.collectRooms('dynamic').then(result => {
                            const list = result['dynamic'];
                            data['data'] = Array.from(list).filter(room => !this.fixedRooms.has(room));
                            worker.send(data);
                        });
                    };
                    if (this.fixedEstablished === true) {
                        this.dynamicTask();
                        this.dynamicTask = null;
                    }
                    break;
            }
        }

        printGift(type, gift) {
            const mapping = {
                'gift':  0b0001,
                'guard': 0b0010,
                'pk':    0b0100,
                'storm': 0b1000,
            };
            let giftText = '';
            switch (mapping[type]) {
                case 0b0001:
                    // fall through
                    // gift
                case 0b0010:
                    // fall through
                    // guard
                case 0b0100:
                    // pk
                    giftText = `${gift['id'].toString().padEnd(13)}`
                        + `@${gift['roomid'].toString().padEnd(13)}`
                        + `${gift['type'].padEnd(13)}`
                        + `${gift['name']}`;
                    break;
                case 0b1000:
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


        collectRooms(type) {

            const giftList = new Set();
            const fixedList = new Set();
            const dynamicList = new Set();

            const getGift = (type === 'all' || type === 'gift');
            const getFixed = (type === 'all' || type === 'fixed');
            const getDynamic = (type === 'all' || type === 'dynamic');

            const addToList = (dest) => {
                return (source) => {
                    source && source.forEach(roomid => dest.add(roomid));
                    return null;
                };
            };
            const reportError = (returnValue) => {
                return (error) => {
                    cprint(`${error}`, colors.red);
                    return returnValue;
                };
            };
            const getFixedFromDB = () => {
                // 数据库获取永久房间
                let result = [];
                if (getFixed) {
                    result = this.db && this.db.getRoomList().catch(reportError([]));
                }
                return Promise.resolve(result);
            };
            const addFromAPI = (roomInfoList) => {
                // 源自b站API, 带有online人气 (可过滤)
                const list = [];
                roomInfoList && roomInfoList.forEach(roomInfo => {
                    const roomid = roomInfo['roomid'];
                    const online = roomInfo['online'];

                    if (fixedList.has(roomid) === false)
                        dynamicList.add(roomid);
                });
            };
            const getDynamicFromAPI = () => {
                // b站api获取动态房间
                let result = [];
                const GLOBAL = 0;
                if (getDynamic) {
                    result = Bilibili.getRoomsInArea(GLOBAL).catch(reportError([]));
                }
                return result;
            };
            const parseResult = () => {
                return {
                    'gift': giftList,
                    'fixed': fixedList,
                    'dynamic': dynamicList,
                };
            };

            return getFixedFromDB()
                .then(addToList(fixedList))
                .then(getFixedFromDB)
                .then(addToList(fixedList))
                .then(getDynamicFromAPI)
                .then(addFromAPI)
                .catch(error => {
                    cprint(`${this.collectRooms.name} - ${error}`, colors.red);
                })
                .then(parseResult);
        }
    }

    module.exports = Master;

})();
