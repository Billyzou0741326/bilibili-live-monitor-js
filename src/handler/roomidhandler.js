'use strict';

const colors = require('colors/safe');

const { roomidEmitter, raffleEmitter } = require('../global/config.js');
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
                Bilibili.getRaffleInRoom(roomid).then((result) => {
                    this.handleMessage(roomid, result);
                }).catch((error) => {
                    cprint(`${Bilibili.getRaffleInRoom.name} - ${error}`, colors.red);
                });
            });
        }
    }

    handleMessage(roomid, data) {
        let guards = data['data']['guard'];
        let gifts = data['data']['gift'];

        // Use setTimeout to wait for cool down
        guards = guards.map(g => {
            let guard_level = g['privilege_type'];
            let guard_name = this.guard_type[guard_level] || '未知';
            return {
                'gift_data': {
                    'id': g['id'], 
                    'roomid': roomid, 
                    'type': g['keyword'], 
                    'name': guard_name,
                }, 
                'time_wait': g['time_wait'], 
            };
        });
        gifts = gifts.map(g => {
            let gift_id = g['gift_id'];
            let gift_name = this.gift_type[gift_id] || '未知';
            return {
                'gift_data': {
                    'id': g['raffleId'], 
                    'roomid': roomid, 
                    'type': g['type'], 
                    'name': gift_name, 
                }, 
                'time_wait': g['time_wait'],
            };
        });

        guards.forEach((g) => {
            const id = g['gift_data']['id'];
            if (!this.guard_history.has(id)) {
                this.guard_history.add(id);
                raffleEmitter.emit('guard', g['gift_data']);    // on 'guard'
            }
        });

        gifts.forEach((g) => {
            const id = g['gift_data']['id'];
            let cool_down = g['time_wait'];
            cool_down = cool_down > 0 ? cool_down : 0;
            if (!this.gift_history.has(id)) {
                this.gift_history.add(id);
                setTimeout(() => {
                    raffleEmitter.emit('gift', g['gift_data']); // on 'gift'
                }, cool_down * 1000);
            }
        });
    }
}

module.exports = RoomidHandler;
