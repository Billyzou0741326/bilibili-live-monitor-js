(function() {

    'use strict';

    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    const Bilibili = require('../bilibili.js');
    const Database = require('../db/database.js');

    class RoomCollector {

        constructor(database) {
            this.db = null;
            if (database instanceof Database) {
                this.db = database;
            }
        }

        /** 
         * @returns     Promise -> Array[int]
         */
        getDynamicRooms() {
            const GLOBAL = 0;
            return Bilibili.getRoomsInArea(GLOBAL).then(roomInfoList => {
                return roomInfoList.map(roomInfo => {
                    const online = roomInfo['online'];  // api的在线人数（might not be accurate）
                    const roomid = roomInfo['roomid'];

                    return roomid;
                });
            }).catch(error => {
                cprint(`Error(getDynamic): ${error}`, colors.red);
                // 失败则返回空Array
                return Promise.resolve([]);
            });
        }

        /**
         * @returns     Promise -> Array[int]
         */
        getFixedRooms() {
            const result = Promise.all([
                this.getFixedFromDB(),
                this.getFixedFromAPI(),
            ]).then(lists => {
                // 并 nested list 为 one-dimensional list
                // i.e:  [].concat( [ 1, 2, 3 ], [ 4, 5, 6 ] )   ->   [ 1, 2, 3, 4, 5, 6 ]
                const mayHaveDuplicateRooms = [].concat(...lists);
                return Array.from(new Set(mayHaveDuplicateRooms));
            }).catch(error => {
                cprint(`Error(getFixed): ${error}`, colors.red);
                return Promise.resolve([]);
            });

            return result;
        }

        // part of fixed
        getFixedFromDB() {
            let result = [];
            if (this.db !== null) {
                // getRoomList已catch, 不会报错
                result = this.db.getRoomList();
            }
            return Promise.resolve(result);
        }

        // part of fixed
        getFixedFromAPI() {
            const getFixedTask1 = Bilibili.getAllSailboatRooms().catch(() => []);
            const getFixedTask2 = Bilibili.getAllGenkiRooms().catch(() => []);

            const allFixedFromAPI = (async () => 
                [].concat(...(await Promise.all([
                    getFixedTask1,
                    getFixedTask2, ]))));

            return allFixedFromAPI();
        }
    }

    module.exports = RoomCollector;

})();
