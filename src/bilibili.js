(function() {
    'use strict';

    const colors = require('colors/safe');

    // ------------------------------- Includes -------------------------------
    const http = require('http');
    const https = require('https');
    const crypto = require('crypto');
    const querystring = require('querystring');
    const cprint = require('./util/printer.js');
    const RateLimiter = require('./util/ratelimiter.js');
    const { 
        appCommon,
        appSecret,
        appHeaders,
        webHeaders, } = require('./global/config.js');

    const httpsAgent = (() => {
        const options = {
            'keepAlive': true,
            'maxFreeSockets': 10,
        };
        return new https.Agent(options);
    })();

    const httpAgent = (() => {
        const options = {
            'keepAlive': true,
            'maxFreeSockets': 256,
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

            const doRequest = async () => {
                for (let i = 0; i < tries; ++i) {
                    try {
                        let result = await newRequest();
                        return result;
                    } catch (error) {
                        cprint(`${error}`, colors.red);
                        cprint(`[ 修正 ${i} ]: 重现request`, colors.green);
                    }
                }
                return newRequest();
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
                            const jsonStr = Buffer.concat(dataSequence).toString('utf8');
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

            return doRequest();
        }

        static appGetRaffleInRoom(roomid) {
            const host = 'api.live.bilibili.com';
            const path = '/xlive/lottery-interface/v1/lottery/getLotteryInfo';
            const method = 'GET';
            const headers = {};
            Object.assign(headers, appHeaders);

            const params = {};
            Object.assign(params, appCommon);
            params['roomid'] = roomid;
            params['ts'] = Number.parseInt(0.001 * new Date());
            const querystr = Bilibili.parseAppParams(sort(params));

            const options = {
                host,
                'path': `${path}?${querystr}`,
                method,
                headers,
            };

            return Bilibili.request(options, false);
        }

        /** Check for lottery in room ``roomid``
         *
         */
        static getRaffleInRoom(roomid, cookies=null) {
            const host = 'api.live.bilibili.com';
            const path = '/xlive/lottery-interface/v1/lottery/Check';
            const method = 'GET';
            const headers = webHeaders;
            const params = { 'roomid': roomid, };
            const query = querystring.stringify(params);
            const options = {
                'host': host,
                'path': `${path}?${query}`,
                'method': method,
                'headers': headers,
            };

            return Bilibili.request(options, false);
        }

        /**
         * 永久监听目标
         * @returns     Promise -> Array[int]
         */
        static getFixedRooms() {
            return Bilibili.getAllSailboatRooms();
        }

        /**
         * 大航海榜
         * @returns     Promise -> Array[int]
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
            const method = 'GET';
            const headers = webHeaders;
            const options = {
                'host': url,
                'path': `${path}?${query}`,
                'method': method,
                'headers': headers,
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
            const method = 'GET';
            const headers = webHeaders;
            const page_size = size;
            const params = {
                'parent_area_id': areaid, 
                'page': 0, 
                'page_size': size > 99 || size < 0 ? 99 : size, 
                'sort_type': 'online',
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
                        'method': method,
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
            const method = 'GET';
            const headers = webHeaders;
            const options = {
                'host': url, 
                'path': `${path}?${query}`,
                'method': method,
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
            const method = 'GET';
            const headers = webHeaders;
            const options = {
                'host': url,
                'path': path,
                'method': method,
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
            const method = 'GET';
            const headers = webHeaders;
            const areas = [ 1, 2, 3, 4, 5, 6, ];

            let promises = [];

            areas.forEach((areaid) => {

                params['parent_area_id'] = areaid;
                const query = querystring.stringify(params);
                const options = {
                    'host': url, 
                    'path': `${path}?${query}`, 
                    'method': method,
                    'headers': headers, 
                };

                promises.push(rateLimiter.request(options, false));

            });

            return promises;    // a list of promises, each element is list of rooms in an area
        }

        static isLive(roomid) {
            const url = 'api.live.bilibili.com';
            const path = '/room/v1/Room/room_init';
            const method = 'GET';
            const params = {
                'id': roomid, 
            };
            const headers = webHeaders;
            const query = querystring.stringify(params);
            const options = {
                'host': url, 
                'path': `${path}?${query}`, 
                'method': method,
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

        static appSign(string) {
            return crypto.createHash('md5').update(string+appSecret).digest('hex');
        }

        static parseAppParams(params) {
            const pre_paramstr = Bilibili.formatForm(params);
            const sign = Bilibili.appSign(pre_paramstr);
            const paramstr = `${pre_paramstr}&sign=${sign}`;
            return paramstr;
        }

        static formatForm(form) {
            const formattedForm = querystring.stringify(form, '&', '=');
            return formattedForm;
        }
    }

    /**
     * Sort the properties according to alphabetical order
     */
    const sort = (object) => {
        const sorted = Object.create(null);
        Object.keys(object).sort().forEach(key => {
            sorted[key] = object[key];
        });
        return sorted;
    };

    // const rateLimiter = new RateLimiter(Bilibili);
    const rateLimiter = Bilibili;

    module.exports = Bilibili;

})();
