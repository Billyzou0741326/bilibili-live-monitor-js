'use strict';

const colors = require('colors/safe');

const config = require('../global/config.js');
const cprint = require('../util/printer.js');
const Bilibili = require('../bilibili.js');
const {
    GuardMonitor, 
    FixedGuardMonitor, 
    RaffleMonitor } = require('../danmu/bilibilisocket.js');
const {
    sleep } = require('../util/utils.js');

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
        this.roomWaitList = {
            'fixed': new Set(),
            'dynamic': new Set(),
        };
    }

    run() {
        this.initialSetup();
        this.scheduledCheck = setInterval(() => {
            this.collectRooms('dynamic').then(() => {
                return this.setupDynamic().then(() => this.roomWaitList['dynamic'].clear());
            });
            const mem = process.memoryUsage();
            const memTip = `Memory Usage: ${mem.heapUsed}/${mem.heapTotal} (ext ${mem.external})`;
            cprint(`Monitoring ${this.connections.size} rooms`, colors.green);
            cprint(memTip, colors.green);
        }, 120 * 1000);
    }

    initialSetup() {
        this.collectRooms('all').then(() => {
            this.db && this.db.destroy().then(() => this.db.setup());
            return this.setupFixed().then(() => {
                this.roomWaitList['fixed'].clear();
            });
        }).then(() => {
            return this.setupDynamic().then(() => {
                this.roomWaitList['dynamic'].clear();
            });
        });
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

    collectRooms(settings='all') {
        const waitList = this.roomWaitList;
        const fixedList = waitList['fixed'];
        const dynamicList = waitList['dynamic'];

        const getFixed = (settings === 'all' || settings === 'fixed');
        const getDynamic = (settings === 'all' || settings === 'dynamic');

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
        const getFixedFromAPI = () => {
            // b站大航海榜api获取永久房间
            let result = [];
            if (getFixed) {
                result = Bilibili.getFixedRooms().catch(reportError([]));
            }
            return Promise.resolve(result);
        };
        const getDynamicFromAPI = () => {
            // b站api获取动态房间
            let result = []
            const GLOBAL = 0;
            if (getDynamic) {
                result = Bilibili.getRoomsInArea(GLOBAL).catch(reportError([]));
            }
            return result;
        };

        return getFixedFromAPI()
            .then(addToList(fixedList))
            .then(getFixedFromDB)
            .then(addToList(fixedList))
            .then(getDynamicFromAPI)
            .then(roomInfoList => {
                // 源自b站API, 带有online人气 (可过滤)
                roomInfoList.forEach(roomInfo => {
                    const roomid = roomInfo['roomid'];
                    const online = roomInfo['online'];

                    if (fixedList.has(roomid) === false)
                        dynamicList.add(roomid);
                });
            })
            .then(addToList(dynamicList))
            .catch(error => {
                cprint(`${this.collectRooms.name} - ${error}`, colors.red);
            });
    }

    setupFixed() {
        const fixedList = Array.from(this.roomWaitList['fixed']);

        const tasks = fixedList.map((roomid, index) => {
            return (async () => {
                await sleep(index * 50);    // 50ms 间隔
                this.setupFixedMonitorAtRoom(roomid);
            })();
        });
        return Promise.all(tasks);
    }

    setupDynamic() {
        const dynamicList = Array.from(this.roomWaitList['dynamic']);

        const tasks = dynamicList.map((roomid, index) => {
            return (async () => {
                await sleep(index * 20);    // 20ms 间隔
                this.setupDynamicMonitorAtRoom(roomid);
            })();
        });

        return Promise.all(tasks).then(() => {
            if (this.recentlyClosed.length > 30) {
                this.recentlyClosed.splice(20);
            }
        });
    }

    setupDynamicMonitorAtRoom(roomid) {

        if (this.recentlyClosed.includes(roomid)
            || this.connections.has(roomid)) return null;

        const dmlistener = new GuardMonitor(roomid, 0);
        this.connections.set(roomid, dmlistener);
        dmlistener.on('close', () => {
            this.connections.delete(roomid);
            this.recentlyClosed.push(roomid);

            // 上舰人数超过3，加入永久监听
            if (dmlistener.guardCount > 3) {
                this.setupFixedMonitorAtRoom(roomid);
            }
        });
        dmlistener.run();
    }

    setupFixedMonitorAtRoom(roomid) {

        if (this.connections.has(roomid)) return null;

        const dmlistener = new FixedGuardMonitor(roomid, 0);
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
