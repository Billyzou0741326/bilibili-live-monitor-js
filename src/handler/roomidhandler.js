'use strict';

const colors = require('colors/safe');

const { roomidEmitter, raffleEmitter } = require('../global/config.js');
const Bilibili = require('../bilibili.js');
const verbose = require('../global/config.js').verbose;
const cprint = require('../util/printer.js');

class RoomidHandler {

    constructor() {
        this.emitter = roomidEmitter;
        this.installed = false;
    }

    run() {
        if (this.emitter && this.installed === false) {
            let callback = this.handleMessage;
            this.installed = true;

            this.emitter.on('gift', (roomid) => {
                Bilibili.getRaffleInRoom(roomid, callback);
            });
        }
    }

    handleMessage(roomid, jsonStr) {
        let data = JSON.parse(jsonStr);

        let guards = data['data']['guard'];
        let gifts = data['data']['gift'];

        // Use setTimeout to wait for cool down
        guards = guards.map(g => {
            return {
                'gift_data': {
                    'id': g['id'], 
                    'roomid': roomid, 
                    'type': g['keyword'], 
                }, 
                'time_wait': g['time_wait'], 
            };
        });
        gifts = gifts.map(g => {
            return {
                'gift_data': {
                    'id': g['raffleId'], 
                    'roomid': roomid, 
                    'type': g['type'], 
                }, 
                'time_wait': g['time_wait'],
            };
        });

        guards.forEach((g) => {
            raffleEmitter.emit('guard', g['gift_data']);
        });

        gifts.forEach((g) => {
            let cool_down = g['time_wait'];
            cool_down = cool_down > 0 ? cool_down : 0;
            setTimeout(() => {
                raffleEmitter.emit('gift', g['gift_data']);
            }, cool_down * 1000);
        });
    }
}

module.exports = RoomidHandler;
