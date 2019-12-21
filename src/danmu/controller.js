'use strict';

const colors = require('colors/safe');

const config = require('../global/config.js');
const cprint = require('../util/printer.js');
const Bilibili = require('../bilibili.js');
const {
    GuardMonitor, 
    FixedGuardMonitor, 
    RaffleMonitor } = require('../danmu/bilibilisocket.js');

class GuardController {

    /**
     * @params  options     Object
     *          limit       Integer
     *          db          Database
     */
    constructor(options) {
        const { limit, db } = options;
        this.limit = limit;
        this.db = db || null;
        this.connections = new Map();
        this.scheduledCheck = null;
        this.recentlyClosed = [];
    }

    run() {
        this.setupFixedMonitor().then(() => {
            this.setupGuardMonitor();
        });
        this.scheduledCheck = setInterval(() => {
            this.setupGuardMonitor();
            const mem = process.memoryUsage();
            const memTip = `Memory Usage: ${mem.heapUsed}/${mem.heapTotal} (ext ${mem.external})`;
            cprint(`Monitoring ${this.connections.size} rooms`, colors.green);
            cprint(memTip, colors.green);
        }, 120 * 1000);
    }

    close() {
        this.scheduledCheck && clearInterval(this.scheduledCheck);
        this.scheduledCheck = null;
        this.connections.forEach((value, key) => {
            value.removeAllListeners([ 'close' ]);
            value.close();
        });
        this.connections.clear();
    }

    setupGuardMonitor() {
        const GLOBAL = 0;

        if (this.limit && this.connections.size > this.limit - 100) {
            cprint(`Reaching limit ${this.limit}, stops connecting`, colors.yellow);
            return;
        }

        if (this.recentlyClosed.length > 30) {
            this.recentlyClosed.splice(20);
        }

        let promise = Bilibili.getRoomsInArea(GLOBAL);

        promise.then(roomInfoList => {

            // { 房间号, 在线人数 }
            // { 'roomid': roomid, 'online': online }
            roomInfoList.forEach(roomInfo => {
                const roomid = roomInfo['roomid'];
                const online = roomInfo['online'];

                if (online > 0
                    && this.connections.has(roomid) === false
                    && this.recentlyClosed.includes(roomid) === false) {

                    let dmlistener = new GuardMonitor(roomid, 0);
                    this.connections.set(roomid, dmlistener);
                    dmlistener.on('close', () => {
                        this.connections.delete(roomid);
                        this.recentlyClosed.push(roomid);

                        // 上舰人数超过3，加入永久监听
                        if (dmlistener.guardCount > 3) {
                            this.setupFixedMonitorAtRoom(roomid);
                        }
                        if (config.verbose === true)
                            cprint(`@room ${roomid} socket emitted close.`, colors.yellow);
                    });
                    dmlistener.run();
                }
            });

        }).catch((error) => {

            cprint(`${Bilibili.getRoomsInArea.name} - ${error}`, colors.red);
        });

    }

    setupFixedMonitor() {
        return Bilibili.getFixedRooms()
            .then(roomList => {
                roomList.forEach(roomid => {
                    if (this.connections.has(roomid) === false) {
                        this.setupFixedMonitorAtRoom(roomid);
                    }
                });
                return null;
            })
            .catch(error => {
                cprint(`${Bilibili.getFixedRooms.name} - ${error}`, colors.red);
                return null;
            })
            .then(() => {
                this.db && this.db.getRoomList().then(roomList => {
                    roomList.forEach(roomid => {
                        if (this.connections.has(roomid) === false) {
                            this.setupFixedMonitorAtRoom(roomid);
                        }
                    });
                });
                return null;
            })
            .catch(error => {
                cprint(`${Bilibili.getFixedRooms.name} - ${error}`, colors.red);
            });
    }

    setupFixedMonitorAtRoom(roomid) {
        let dmlistener = new FixedGuardMonitor(roomid, 0);
        this.connections.set(roomid, dmlistener);
        dmlistener.on('close', () => {
            this.connections.delete(roomid);
            this.recentlyClosed.push(roomid);
        });
        dmlistener.run();
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
                const areaid = entries[0]['parent_id'] || areas[index];
                const roomids = entries.map((entry) => {
                    return entry['roomid'];
                });
                this.setupRaffleMonitorInArea(areaid, roomids);

            }).catch((errorMsg) => {
                cprint(`${Bilibili.getRoomsInEachArea.name} - ${error}`, colors.red);
            });
        });
    }

    setupRaffleMonitorInArea(areaid, rooms) {
        rooms.forEach((roomid) => {

            Bilibili.isLive(roomid).then((streaming) => {
                if (streaming && !this.connections.has(areaid)) {

                    const dmlistener = new RaffleMonitor(roomid, 0, areaid);
                    this.connections.set(areaid, dmlistener);

                    const msg = `Setting up monitor @room ${roomid.toString().padEnd(13)}`
                            + `in ${this.areaname[areaid]}区`;
                    cprint(msg, colors.green);
                    dmlistener.on('close', () => {
                        const reason = `@room ${roomid} in ${this.areaname[areaid]}区 is closed.`;
                        cprint(reason, colors.yellow);
                        this.connections.delete(areaid);
                        this.recoverArea(areaid);
                    });
                    dmlistener.run();
                }
            }).catch((error) => {
                cprint(`${Bilibili.isLive.name} - ${error}`, colors.red);
            });
        });
    }

    recoverArea(areaid) {
        Bilibili.getRoomsInArea(areaid, 10, 10).then((roomInfoList) => {

            const room_list = roomInfoList.map((roomInfo) => {
                return roomInfo['roomid'];
            });
            this.setupRaffleMonitorInArea(areaid, room_list);

        }).catch((error) => {
            cprint(`${Bilibili.getRoomsInArea.name} - ${error}`, colors.red);
        });
    }

    close() {
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
