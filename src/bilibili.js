(function() {
    'use strict';

    const colors = require('colors/safe');

    // ------------------------------- Includes -------------------------------
    const http = require('http');
    const https = require('https');
    const querystring = require('querystring');
    const cprint = require('./util/printer.js');
    const RateLimiter = require('./util/ratelimiter.js');

    const httpsAgent = (() => {
        const options = {
            'keepAlive': true, 
            'maxFreeSockets': 128, 
        };
        return new https.Agent(options);
    })();

    const httpAgent = (() => {
        const options = {
            'keepAlive': true, 
            'maxFreeSockets': 128, 
        };
        return new http.Agent(options);
    })();


    /** Emits requests to the bilibili API */
    class Bilibili {

        /**
         * Send request, gets json as response
         * 发送请求，获取json返回
         * 
         * @params  options    request details
         * @params  useHttps   true: https   false: http
         * @returns promise -> json / error
         */
        static request(options, useHttps=true, data='') {

            let tries = 3;
            let xhr = http;
            let agent = httpAgent;

            if (useHttps === true) {
                xhr = https;
                agent = httpsAgent;
            }
            options['agent'] = options['agent'] || agent;

            const doRequest = (promise) => {
                return promise.catch((error) => {
                    if (tries > 0) {
                        cprint(`${error}`, colors.red);
                        cprint(`[ 修正 ${3-tries} ]: 重现request`, colors.green);
                        --tries;
                        return doRequest(newRequest());
                    } else {
                        throw error;
                    }
                });
            };
            const newRequest = () => new Promise((resolve, reject) => {

                const req = xhr.request(options, (response) => {

                    response.on('error', (error) => {
                        reject(`Error: ${error.message}`);
                    });
                    if (response.statusCode === 200) {
                        let dataSequence = [];

                        response.on('data', (data) => {
                            dataSequence.push(data);
                        });
                        response.on('end', () => {
                            const jsonStr = Buffer.concat(dataSequence).toString();
                            try {
                                const jsonObj = JSON.parse(jsonStr);
                                resolve(jsonObj);
                            } catch (error) {
                                reject(`Error: ${error.message}`);
                            }
                        });
                    } else {
                        reject(`Error: Response status code ${response.statusCode}`);
                    }
                }).on('error', (error) => {
                    reject(`Error: ${error.message}`);
                })
                req.write(data);
                req.end();
            });

            return doRequest(newRequest());
        }

        /** Check for lottery in room ``roomid``
         *
         */
        static getRaffleInRoom(roomid, cookies=null) {
            const host = 'api.live.bilibili.com';
            const path = '/xlive/lottery-interface/v1/lottery/Check';
            const params = { 'roomid': roomid, };
            const query = querystring.stringify(params);
            const headers = {
                'Cookie': cookies !== null ? cookies : {}, 
                'Connection': 'close', 
            };
            const options = {
                'headers': headers, 
                'host': host, 
                'path': `${path}?${query}`, 
            };

            return Bilibili.request(options, false);
        }

        /**
         * 永久监听目标
         */
        static getFixedRooms() {
            return Bilibili.getAllSailboatRooms();
        }

        /**
         * 大航海榜
         * 返回值: Array - roomid
         */
        static getAllSailboatRooms() {
            const MAX_PAGES = 3;
            const promises = [];

            for (let page = 1; page <= MAX_PAGES; ++page) {
                promises.push(
                    Bilibili.getSailboatRooms(page)
                    .then(jsonObj => {
                        return jsonObj['data']['list'].map(entry => entry['roomid']);
                    })
                    .catch(error => {
                        cprint(`${Bilibili.getSailboatRooms.name} - ${error}`, colors.red);
                        return [];
                    })
                );
            }

            const result = Promise.all(promises).then(lists => {
                const finalList = [];
                lists.forEach(list => {
                    list.forEach(roomid => finalList.push(roomid));
                });
                return finalList;
            });

            return result;
        }

        static getSailboatRooms(page) {
            // Page 1-3 (Rank 0-50)
            const url = 'api.live.bilibili.com';
            const path = '/rankdb/v1/Rank2018/getWebTop';
            const page_size = 20;   // 必须是20
            const params = {
                'type': 'sail_boat_number',
                'page': page,
                'is_trend': 1,
                'page_size': page_size,
            };
            const query = querystring.stringify(params);
            const headers = { 'Connection': 'close' };
            const options = {
                'headers': headers,
                'host': url,
                'path': `${path}?${query}`,
            };

            return rateLimiter.request(options, false);
        }

        /** 
         * Get streaming roomd in area ``areaid``
         * @return promise -> [ { 'roomid': roomid, 'online': online }, ... ]
         */
        static getRoomsInArea(areaid, size=99, count=Infinity) {
            const url = 'api.live.bilibili.com';
            const path = '/room/v3/area/getRoomList';
            const page_size = size;
            const params = {
                'parent_area_id': areaid, 
                'page': 0, 
                'page_size': size > 99 || size < 0 ? 99 : size, 
                'sort_type': 'online',
            };
            const headers = {
                'Connection': 'close',
            };

            let promises = [];

            const promise = Bilibili.getLiveCount().catch(error => {

                cprint(`${Bilibili.getLiveCount.name} - ${error}`, colors.red);
                return 5000;    // 出错则返回默认5000

            }).then(room_count => {

                room_count = Math.min(count, room_count);
                const page = Number.parseInt(Math.round(room_count / page_size)) + 2;

                for (let i = 1; i < page; ++i) {
                    params.page = i;
                    const query = querystring.stringify(params);
                    const options = {
                        'host': url, 
                        'path': `${path}?${query}`, 
                        'headers': headers, 
                    };
                    const x = i;

                    promises.push(new Promise((resolve, reject) => {

                        rateLimiter.request(options, false).then((jsonObj) => {
                            if (jsonObj['code'] !== 0) {
                                reject(`Error: API code ${jsonObj['code']}`);
                            } else {
                                const rooms_info = jsonObj['data']['list'].map(entry => { 
                                    return {
                                        'roomid': entry['roomid'], 
                                        'online': entry['online'], 
                                    };
                                });
                                resolve(rooms_info);
                            }
                        }).catch((error) => {
                            reject(`${getRoomsInArea} - ${error}`);
                        });

                    }).catch(error => {
                        cprint(error, colors.red);
                        return [];
                    }));
                }

                const roomInfos = [];
                return Promise.all(promises).then(roomInfoLists => {

                    roomInfoLists.forEach(roomInfoList => {
                        roomInfoList.forEach(roomInfo => {
                            roomInfos.push(roomInfo);
                        });
                    });

                    return roomInfos;
                });
            });

            return promise;
        }

        /**
         *
         */
        static getLiveCount() {
            const url = 'api.live.bilibili.com';
            const path = '/room/v3/area/getRoomList';
            const params = {
                'parent_area_id': 0, 
                'page': 1, 
                'page_size': 1, 
                'sort_type': 'online', 
            };
            const query = querystring.stringify(params);
            const headers = {
                'Connection': 'close', 
            };
            const options = {
                'host': url, 
                'path': `${path}?${query}`,
                'headers': headers, 
            };


            return new Promise((resolve, reject) => {
                rateLimiter.request(options, false).then((jsonObj) => {
                    const count = jsonObj['data']['count'];
                    resolve(count);
                }).catch((error) => {
                    reject(error);
                });
            });
        }

        static getGiftConfig() {
            const url = 'api.live.bilibili.com';
            const path = '/gift/v4/Live/giftConfig';
            const params = {};
            const headers = {
                'Connection': 'close', 
            };
            const options = {
                'host': url, 
                'path': path, 
                'headers': headers, 
            };

            return rateLimiter.request(options, false);
        }

        static getRoomsInEachArea() {
            const url = 'api.live.bilibili.com';
            const path = '/room/v3/area/getRoomList';
            const params = {
                'parent_area_id': 0, 
                'page': 1, 
                'page_size': 10, 
                'sort_type': 'online', 
            };
            const headers = {
                'Connection': 'close', 
            };
            const areas = [ 1, 2, 3, 4, 5, 6, ];

            let promises = [];

            areas.forEach((areaid) => {

                params['parent_area_id'] = areaid;
                const query = querystring.stringify(params);
                const options = {
                    'host': url, 
                    'path': `${path}?${query}`, 
                    'headers': headers, 
                };

                promises.push(rateLimiter.request(options, false));

            });

            return promises;    // a list of promises, each element is list of rooms in an area
        }

        static isLive(roomid) {
            const url = 'api.live.bilibili.com';
            const path = '/room/v1/Room/room_init';
            const params = {
                'id': roomid, 
            };
            const headers = {
                'Connection': 'close', 
            };
            const query = querystring.stringify(params);
            const options = {
                'host': url, 
                'path': `${path}?${query}`, 
                'headers': headers, 
            };

            return new Promise((resolve, reject) => {
                rateLimiter.request(options, false).then((jsonObj) => {
                    const isLive = jsonObj['data']['live_status'] === 1 ? true : false;
                    resolve(isLive);
                }).catch((error) => {
                    reject(error);
                });
            });
        }
    }

    const rateLimiter = new RateLimiter(Bilibili);

    module.exports = Bilibili;

})();
