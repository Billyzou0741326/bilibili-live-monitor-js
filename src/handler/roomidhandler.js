'use strict';

const colors = require('colors/safe');

const { roomidEmitter, raffleEmitter } = require('../global/config.js');
const GuardBuilder = require('./guard.js');
const GiftBuilder = require('./gift.js');
const Bilibili = require('../bilibili.js');
const config = require('../global/config.js');
const cprint = require('../util/printer.js');

class RoomidHandler {

    constructor() {
        this.emitter = roomidEmitter;
        this.installed = false;
        this.guard_type = {};
        this.gift_type = {};
        this.gift_history = new Set();
        this.guard_history = new Set();

        this.queue = [];

        this.checkLoop = setInterval(() => {
            this.processQueue();
        }, 5 * 1000);
    }

    run() {
        Bilibili.getGiftConfig().then((response, error) => {
            response['data']['list'].forEach((entry) => {
                this.gift_type[entry['id']] = entry['name'];
            });
            response['data']['guard_resources'].forEach((entry) => {
                this.guard_type[entry['level']] = entry['name'];
            });
            this.listen();
        }).catch(error => {
            cprint(`${Bilibili.getGiftConfig.name} - ${error}`, colors.red);
            this.listen();
        });
    }

    listen() {
        if (this.emitter && this.installed === false) {
            let callback = this.handleMessage;
            this.installed = true;

            this.emitter.on('gift', (roomid) => {
                this.enqueue(roomid);
            });
        }
    }

    enqueue(roomid) {
        this.queue.push(roomid);
    }

    processQueue() {
        const queue = Array.from(new Set(this.queue));
        this.queue = [];
        queue.forEach((roomid) => {
            Bilibili.getRaffleInRoom(roomid).then((result) => {
                this.handleMessage(roomid, result);
            }).catch((error) => {
                cprint(`${Bilibili.getRaffleInRoom.name} - ${error}`, colors.red);
            });
        });
    }

    handleMessage(roomid, data) {
        let guards = data['data']['guard'];
        let gifts = data['data']['gift'];

        // Use setTimeout to wait for cool down
        guards = guards.map(g => {
            let guard_level = g['privilege_type'];
            let guard_name = this.guard_type[guard_level] || '未知';
            return GuardBuilder.start()
                .withId(g['id'])
                .withRoomid(roomid)
                .withType(g['keyword'])
                .withName(guard_name)
                .withExpireAt(g['time'] + Number.parseInt(new Date() / 1000))
                .build();
        });
        gifts = gifts.map(g => {
            let gift_id = g['gift_id'];
            let gift_name = this.gift_type[gift_id] || '未知';
            return GiftBuilder.start()
                .withId(g['raffleId'])
                .withRoomid(roomid)
                .withType(g['type'])
                .withName(gift_name)
                .withWait(g['time_wait'])
                .withExpireAt(g['time'] + Number.parseInt(0.001 * new Date()))
                .build();
        });

        guards.forEach((g) => {
            const id = g.id;

            if (!this.guard_history.has(id)) {
                this.guard_history.add(id);
                if (this.guard_history.size > 1000) {
                    const len = this.guard_history.size;
                    this.guard_history = Array.from(this.guard_history).splice(500);
                    this.guard_history = new Set(this.guard_history);
                }

                // raffleEmitter.emit('guard', g['gift_data']);    // on 'guard'
                raffleEmitter.emit('guard', g);
            }
        });

        gifts.forEach((g) => {
            const id = g.id;
            let cool_down = g.wait;
            cool_down = cool_down > 0 ? cool_down : 0;

            if (!this.gift_history.has(id)) {
                this.gift_history.add(id);
                if (this.gift_history.size > 400) {
                    const len = this.gift_history.size;
                    this.gift_history = Array.from(this.gift_history).splice(300);
                    this.gift_history = new Set(this.gift_history);
                }

                setTimeout(() => {
                    raffleEmitter.emit('gift', g); // on 'gift'
                }, cool_down * 1000);
            }
        });
    }
}

module.exports = RoomidHandler;
