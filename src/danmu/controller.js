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
        this.recentlyClosed = [];
    }

    run() {
        this.setupGuardMonitor();
        this.scheduledCheck = setInterval(() => {
            this.setupGuardMonitor();
            cprint(`Monitoring ${this.connections.size} rooms`, colors.green);
        }, 30 * 1000);
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
        const GLOBAL = 0;

        if (this.recentlyClosed > 150) {
            this.recentlyClosed.splice(150, this.recentlyClosed.length - 150);
        }

        let promise = Bilibili.getRoomsInArea(GLOBAL);

        promise.then((promises) => {

            promises.forEach((promise) => {

                promise.then((room_list) => {

                    room_list.forEach((roomInfo) => {
                        const roomid = roomInfo['roomid'];
                        const online = roomInfo['online'];

                        if (online > 50 && this.connections.has(roomid) === false) {
                            let dmlistener = new GuardMonitor(roomid, 0);
                            this.connections.set(roomid, dmlistener);
                            dmlistener.run().then((roomid) => {
                                this.connections.delete(roomid);
                                this.recentlyClosed.push(roomid);
                            });
                        }
                    });
                }).catch((error) => {

                    cprint(`${Bilibili.getRoomsInArea.name} - ${error}`, colors.red);
                });
            });
        }).catch((error) => {
            cprint(`${Bilibili.getRoomsInArea.name} - ${error}`, colors.red);
        });
    }
}


class RaffleController {

    constructor(limit) {
        this.scheduledCheck = null;
        this.connections = new Map();  // areaid: dmlistener
        this.limit = limit;
    }

    run() {
        this.setupRaffleMonitor();
    }

    setupRaffleMonitor() {
        const areas = [ 1, 2, 3, 4, 5, 6 ];

        // the promise returned is strictly in order.
        Bilibili.getRoomsInEachArea().forEach((promise, index) => {

            promise.then((jsonObj) => {

                const entries = jsonObj['data']['list'];
                const roomids = entries.map((entry) => {
                    return entry['roomid'];
                });
                this.setupRaffleMonitorInArea(areas[index], roomids);

            }).catch((errorMsg) => {
                cprint(`${Bilibili.getRoomsInEachArea.name} - ${error}`, colors.red);
            });;
        });
    }

    setupRaffleMonitorInArea(areaid, rooms) {
        rooms.forEach((roomid) => {

            Bilibili.isLive(roomid).then((streaming) => {
                if (streaming && !this.connections.has(areaid)) {

                    cprint(`Setting up monitor in area ${areaid}`, colors.green);
                    let dmlistener = new RaffleMonitor(roomid, 0, areaid);
                    this.connections.set(areaid, dmlistener);
                    cprint(`Setting up monitor @room ${roomid} in ${areaid}`, colors.green);
                    dmlistener.run().then((switchRoom) => {
                        cprint(`@room ${roomid} in ${areaid} is closed.`, colors.yellow);
                        if (switchRoom) {
                            // TODO
                        }
                    });
                }
            }).catch((errorMsg) => {
                cprint(`${Bilibili.isLive.name} - ${error}`, colors.red);
            });
        });
    }

    close() {
        // TODO
        this.scheduledCheck && clearInterval(this.scheduledCheck);
        this.scheduledCheck = null;
        this.connections.forEach((value, key) => {
            value.close();
        });
        this.connections.clear();
    }

}


module.exports = {
    RaffleController, GuardController };
