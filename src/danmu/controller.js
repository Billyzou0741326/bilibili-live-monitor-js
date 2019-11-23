'use strict';

const colors = require('colors/safe');

const cprint = require('../util/printer.js');
const Bilibili = require('../bilibili.js');
const {
    GuardMonitor, RaffleMonitor } = require('../danmu/bilibilisocket.js');

class GuardController {

    constructor(limit) {
        this.limit = limit;
        this.connections = new Map();
        this.scheduledCheck = null;
        this.recentlyClosed = new Set();
    }

    run() {
        this.setupGuardMonitor();
    }

    close() {
        this.scheduledCheck && clearInterval(this.scheduledCheck);
        this.scheduledCheck = null;
        this.connections.forEach((value, key) => {
            value.close();
        });
        this.connections.clear();
    }

    setupGuardMonitor() {
        let i = 0;

        Bilibili.getRoomsInArea(i).then((room_waiter) => {

            room_waiter.forEach((promise) => {
                promise.then((room_list) => {

                    room_list.forEach((roomid) => {
                        
                        if (this.connections.get(roomid) === undefined) {
                            let dmlistener = new GuardMonitor(roomid, 0);
                            this.connections.set(roomid, dmlistener);
                            dmlistener.run();
                        }
                    });
                }).catch((error) => {

                    cprint(error, colors.red);
                });
            });
        });
    }
}


class RaffleController {

    constructor(limit) {
        this.scheduledCheck = null;
    }

    run() {
        this.setupRaffleMonitor();
    }

    setupRaffleMonitor() {
        const areas = [ 1, 2, 3, 4, 5, 6 ];
    }

    close() {
        // TODO
    }

}


module.exports = {
    RaffleController, GuardController };
