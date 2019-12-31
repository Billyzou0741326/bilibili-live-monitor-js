(function() {
    'use strict';

    const colors = require('colors/safe');

    // ------------------------------- Includes -------------------------------
    const http = require('http');
    const https = require('https');
    const crypto = require('crypto');
    const querystring = require('querystring');
    const cprint = require('./util/printer.js');
    const { 
        appCommon,
        appSecret,
        appHeaders,
        webHeaders, } = require('./global/config.js');


    /** https agent to handle request sending */
    const httpsAgent = (() => {
        const options = {
            'keepAlive': true,
            'maxFreeSockets': 10,
        };
        return new https.Agent(options);
    })();

    /** http agent to handle request sending */
    const httpAgent = (() => {
        const options = {
            'keepAlive': true,
            'maxFreeSockets': 256,
        };
        return new http.Agent(options);
    })();


    // ------------------------------- class -------------------------------

    /** Emits requests to the bilibili API */
    class Bilibili {

        /**
         * Send request, returns as json
         * 
         * @static
         * @param   {Object}    options    - request details
         * @param   {boolean}   useHttps   - if https should be used
         * @returns {Promise}   promise -> json / error
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

        /**
         * Gets raffle info in a given room (APP API)
         *
         * @static
         * @params  {Integer}   roomid
         * @returns {Promise}   resolve(json)   reject(String)
         */
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

        /**
         * Check for lottery in room ``roomid``
         *
         * @static
         * @params  {Integer}   roomid
         * @params  {Object}    cookies - defaults to null
         * @returns {Promise}   resolve(json)   reject(String)
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
         * Get sailboat rooms from rank API
         *
         * @static
         * @returns {Promise}   resolve(json)   reject(String)
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
                const finalList = [].concat(...lists);
                return finalList;
            });

            return result;
        }


        /**
         * Get sailboat rooms from rank API
         *
         * @static
         * @params  {Integer}   page    - page of the API, valid values: [1,2,3]
         * @returns {Promise}   resolve(json)   reject(String)
         */
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
         * Get rooms from genki rank API
         *
         * @static
         * @returns     {Promise}   resolve(json)   reject(String)
         */
        static getAllGenkiRooms() {
            const MAX_PAGES = 3;
            const promises = [];

            for (let page = 1; page <= MAX_PAGES; ++page) {
                promises.push(
                    Bilibili.getGenkiRooms(page)
                    .then(jsonObj => {
                        return jsonObj['data']['list'].map(entry => entry['roomid']);
                    })
                    .catch(error => {
                        cprint(`${Bilibili.getGenkiRooms.name} - ${error}`, colors.red);
                        return [];
                    })
                );
            }

            const result = Promise.all(promises).then(lists => {
                const finalList = [].concat(...lists);
                return finalList;
            });

            return result;
        }

        /**
         * Get rooms from genki rank API
         *
         * @static
         * @param   {Integer}   page    - page of API
         */
        static getGenkiRooms(page) {
            const url = 'api.live.bilibili.com';
            const path = '/rankdb/v1/Rank2018/getWebTop';
            const method = 'GET';
            const params = {
                'date': 'month',
                'type': 'master_vitality_2018',
                'areaid': 0,
                'page': page,
                'is_trend': 1,
                'page_size': 20,
            };
            const paramstr = querystring.stringify(params);
            const headers = webHeaders;
            const options = {
                'host': url,
                'path': `${path}?${paramstr}`,
                'method': method,
                'headers': headers,
            };

            return rateLimiter.request(options, false);
        }

        /** 
         * Get streaming roomd in area ``areaid``
         * 
         * @static
         * @param   {Integer}   areaid
         * @param   {Integer}   size
         * @param   {Integer}   count
         * @returns {Promise}   resolve([ { 'roomid': roomid, 'online': online }, ... ])
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
                'sort_type': 'live_time',
            };

            let promises = [];

            const promise = Bilibili.getLiveCount().catch(error => {

                cprint(`${Bilibili.getLiveCount.name} - ${error}`, colors.red);
                return 5000;    // on error return 5000

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
                            reject(`getRoomsInArea - ${error}`);
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
         * Get number of rooms streaming
         *
         * @static
         * @returns {Promise}   resolve(Integer)    reject(String)
         */
        static getLiveCount() {
            const url = 'api.live.bilibili.com';
            const path = '/room/v3/area/getRoomList';
            const params = {
                'parent_area_id': 0,
                'page': 1,
                'page_size': 1,
                'sort_type': 'live_time',
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

        /**
         * Get gift configuration, including id, name, etc
         *
         * @static
         * @returns     {Promise}   resolve(json)   reject(String)
         */
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

        /**
         * Get rooms in each of the six areas
         *
         * @static
         * @returns     {Promise}   resolve([ Array(Integer), Array(Integer), ... ])    reject(String)
         */
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

        /**
         * Get guard list in room
         *
         * @param       {Integer}   roomid
         * @param       {Integer}   uid
         * @returns     {Promise}   resolve(json)   reject(String)
         */
        static getGuardList(roomid, uid=null) {
            const url = 'api.live.bilibili.com';
            const path = '/xlive/app-room/v1/guardTab/topList';
            const method = 'GET';
            const headers = webHeaders;
            const params = {
                'roomid': roomid,
                'ruid': uid,
                'page': 1,
                'page_size': 10,
            };

            if (uid !== null) {
                const paramstr = Bilibili.formatForm(params);
                const options = {
                    'host': url,
                    'path': `${path}?${paramstr}`,
                    'method': method,
                    'headers': headers,
                };
                return rateLimiter.request(options, false);
            }

            return Bilibili.getRoomInfo(roomid).then(resp => {
                const code = resp['code'];
                if (code !== 0) {
                    return Promise.reject(`Failed to getRoomInfo`);
                }
                params['ruid'] = resp['data']['uid'];
                const paramstr = Bilibili.formatForm(params);
                const options = {
                    'host': url,
                    'path': `${path}?${paramstr}`,
                    'method': method,
                    'headers': headers,
                };
                return rateLimiter.request(options, false);
            });
        }

        /**
         * Get basic info of a room
         *
         * @static
         * @param       {Integer}   roomid
         */
        static getRoomInfo(roomid) {
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

            return rateLimiter.request(options, false);
        }

        /**
         * Check if a room is streaming
         *
         * @static
         * @param   {Integer}   roomid
         * @returns {Promise}   resolve(boolean)    reject(String)
         */
        static isLive(roomid) {
            return new Promise((resolve, reject) => {
                Bilibili.getRoomInfo(roomid).then((jsonObj) => {
                    const isLive = jsonObj['data']['live_status'] === 1 ? true : false;
                    resolve(isLive);
                }).catch((error) => {
                    reject(error);
                });
            });
        }

        /**
         * Perform md5 hashing on the passed in String and the app_secret
         *
         * @static
         * @param   {String}    string  - string to be hashed
         * @returns {String}    hashed result
         */
        static appSign(string) {
            return crypto.createHash('md5').update(string+appSecret).digest('hex');
        }

        /**
         * Concatenate sign value to the end of the param string
         *
         * @static
         * @param   {String}    params  - formatted parameter
         * @returns {String}    params with sign appended
         */
        static parseAppParams(params) {
            const pre_paramstr = Bilibili.formatForm(params);
            const sign = Bilibili.appSign(pre_paramstr);
            const paramstr = `${pre_paramstr}&sign=${sign}`;
            return paramstr;
        }

        /**
         * Parses parameters into string form
         *
         * @static
         * @param   {Object}    form    - Object to be formatted into querystring
         * @returns {String}    formatted querystring
         */
        static formatForm(form) {
            const formattedForm = querystring.stringify(form, '&', '=');
            return formattedForm;
        }
    }

    /**
     * Sort the properties according to alphabetical order
     *
     * @param   {Object}    object  - Object to be sorted by keys
     * @returns {Object}    with keys sorted
     */
    const sort = (object) => {
        const sorted = {};
        Object.keys(object).sort().forEach(key => {
            sorted[key] = object[key];
        });
        return sorted;
    };

    const rateLimiter = Bilibili;

    module.exports = Bilibili;

})();
