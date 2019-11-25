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

                        if (online > 10 
                                && this.connections.has(roomid) === false
                                && this.recentlyClosed.includes(roomid) === false) {

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
        this.areaname = {
            '1': '娱乐', 
            '2': '网游', 
            '3': '手游', 
            '4': '绘画', 
            '5': '电台', 
            '6': '单机', 
        };
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

                    let dmlistener = new RaffleMonitor(roomid, 0, areaid);
                    this.connections.set(areaid, dmlistener);

                    let msg = `Setting up monitor @room ${roomid.toString().padEnd(11)}`
                            + `in ${this.areaname[areaid]}区`;
                    cprint(msg, colors.green);
                    dmlistener.run().then((switchRoom) => {
                        if (switchRoom) {
                            // TODO
                            cprint(`@room ${roomid} in ${this.areaname[areaid]}区 is closed.`, colors.yellow);
                            this.connections.delete(areaid);
                            this.recoverArea(areaid);
                        }
                    });
                }
            }).catch((error) => {
                cprint(`${Bilibili.isLive.name} - ${error}`, colors.red);
            });
        });
    }

    recoverArea(areaid) {
        Bilibili.getRoomsInArea(areaid, 10).then((promises) => {
            promises.forEach((promise) => {

                promise.then((room_list) => {
                    room_list = room_list.map((roomInfo) => {
                        const roomid = roomInfo['roomid'];
                        return roomid;
                    });
                    this.setupRaffleMonitorInArea(areaid, room_list);
                }).catch((error) => {
                    cprint(`${Bilibili.getRoomsInArea.name} - ${error}`, colors.red);
                });

            });
        }).catch((error) => {
            cprint(`${Bilibili.getRoomsInArea.name} - ${error}`, colors.red);
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
