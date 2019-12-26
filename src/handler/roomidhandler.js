(function() {

    'use strict';

    const EventEmitter = require('events').EventEmitter;

    const colors = require('colors/safe');
    const cprint = require('../util/printer.js');

    const GuardBuilder = require('./guard.js');
    const GiftBuilder = require('./gift.js');
    const PKBuilder = require('./pk.js');
    const Bilibili = require('../bilibili.js');
    const History = require('./history.js');
    const config = require('../global/config.js');

    class RoomidHandler extends EventEmitter {

        constructor(history) {
            super();
            this.guard_type = {};
            this.gift_type = {};

            this.queue = [];

            this.running = false;
            this.checkLoop = null;

            this.history = (history && history instanceof History) || new History();

            this.bind();
        }

        bind() {
            this.enqueue = this.enqueue.bind(this);
            this.processQueue = this.processQueue.bind(this);
            this.handleMessage = this.handleMessage.bind(this);
        }

        run() {
            if (this.running === false) {

                this.running = true;
                this.history.run();
                this.setup().then(() => {
                    this.checkLoop = setInterval(this.processQueue, 1000 * 5);
                });
            }
        }

        setup() {
            return Bilibili.getGiftConfig().then((response, error) => {
                response['data']['list'].forEach((entry) => {
                    this.gift_type[entry['id']] = entry['name'];
                });
                response['data']['guard_resources'].forEach((entry) => {
                    this.guard_type[entry['level']] = entry['name'];
                });
            }).catch(error => {
                cprint(`${Bilibili.getGiftConfig.name} - ${error}`, colors.red);
            });
        }

        enqueue(roomid) {
            this.queue.push(roomid);
        }

        processQueue() {
            const queue = Array.from(new Set(this.queue));
            this.queue = [];
            queue.forEach((roomid) => {
                Bilibili.appGetRaffleInRoom(roomid).then((result) => {
                    this.handleMessage(roomid, result);
                }).catch((error) => {
                    cprint(`${Bilibili.appGetRaffleInRoom.name} - ${error}`, colors.red);
                });
            });
        }

        handleMessage(roomid, data) {
            let guards = data['data']['guard'];
            let gifts = data['data']['gift_list'];
            let pks = data['data']['pk'];

            // Use setTimeout to wait for cool down
            guards = guards.map(g => {
                let guard_level = g['privilege_type'];
                let guard_name = this.guard_type[guard_level] || '未知';
                return GuardBuilder.start()
                    .withId(g['id'])
                    .withRoomid(roomid)
                    .withType(g['keyword'])
                    .withName(guard_name)
                    .withExpireAt(g['time'] + Number.parseInt(0.001 * new Date()))
                    .build();
            });
            gifts = gifts.map(g => {
                let gift_name = g['title'] || '未知';
                return GiftBuilder.start()
                    .withId(g['raffleId'])
                    .withRoomid(roomid)
                    .withType(g['type'])
                    .withName(gift_name)
                    .withWait(g['time_wait'])
                    .withExpireAt(g['time'] + Number.parseInt(0.001 * new Date()))
                    .build();
            });
            pks = pks.map(g => {
                let gift_name = '大乱斗';
                return PKBuilder.start()
                    .withId(g['id'])
                    .withRoomid(roomid)
                    .withType('pk')
                    .withName(gift_name)
                    .withExpireAt(g['time'] + Number.parseInt(0.001 * new Date()))
                    .build();
            });

            guards.forEach((g) => {
                if (this.history.isUnique('guard', g)) {
                    this.history.addGift(g);

                    this.emit('guard', g);
                }
            });

            gifts.forEach((g) => {
                if (this.history.isUnique('gift', g)) {

                    this.history.addGift(g);

                    let cool_down = g.wait;
                    cool_down = cool_down > 0 ? cool_down : 0;

                    setTimeout(() => {
                        this.emit('gift', g);
                    }, cool_down * 1000);
                }
            });

            pks.forEach((g) => {
                if (this.history.isUnique('pk', g)) {

                    this.history.addGift(g);

                    this.emit('pk', g);
                }
            });
        }
    }

    module.exports = RoomidHandler;

})();
