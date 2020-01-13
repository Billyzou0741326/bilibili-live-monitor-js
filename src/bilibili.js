(function() {
    'use strict';

    const colors = require('colors/safe');

    // ------------------------------- Includes -------------------------------
    const http = require('http');
    const https = require('https');
    const crypto = require('crypto');
    const querystring = require('querystring');
    const cprint = require('./util/printer.js');
    const Xhr = require('./net/xhr.js');
    const RequestBuilder = require('./net/request.js');
    const config = require('./global/config.js');
    const {
        appCommon,
        appSecret,
        appHeaders,
        webHeaders, } = require('./global/config.js');

    const stats = {};   // url -> count
    setInterval(() => {
        const keys = Object.keys(stats);
        if (config.debugHttp === true && keys.length > 0)
            cprint(`\n${JSON.stringify(stats, null, 4)}`, colors.magenta);
        keys.forEach(key => delete stats[key]);
    }, 1000 * 60);

    // ------------------------------- class -------------------------------

    /** Emits requests to the bilibili API */
    class Bilibili {

        /**
         * Send request, returns as json
         * 
         * @static
         * @param   {Request}   req    - request details
         * @returns {Promise}   promise -> json / error
         */
        static request(req) {

            let tries = 3;
            const noRetryStatus = [ 412 ];

            const url = `${req.host}${req.path.split('?')[0]}`;
            const doRequest = async () => {
                let result = null;
                for (let i = 0; i < tries; ++i) {
                    try {
                        if (stats) {
                            if (Number.isInteger(stats[url]) === false)
                                stats[url] = 0;
                            ++stats[url];
                        }
                        result = await newRequest();
                        return result;
                    } catch (error) {
                        cprint(`HttpError: ${error.message}`, colors.red);
                        if (error.status && noRetryStatus.includes(error.status)) {
                            throw error;
                        }
                        cprint(`[ 修正 ${i} ]: 重现request`, colors.green);
                    }
                }
                return newRequest();
            };

            const newRequest = () => xhr.request(req).then(resp => resp.json());

            return doRequest();
        }

        /**
         * Gets raffle info in a given room (APP API)
         *
         * @static
         * @param   {Integer}   roomid
         * @returns {Promise}   resolve(json)   reject(String)
         */
        static appGetRaffleInRoom(roomid) {
            const headers = {};
            const params = {};
            Object.assign(headers, appHeaders);
            Object.assign(params, appCommon);
            params['roomid'] = roomid;
            params['ts'] = Number.parseInt(0.001 * new Date());
            const paramstr = Bilibili.parseAppParams(params);

            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/xlive/lottery-interface/v1/lottery/getLotteryInfo')
                .withMethod('GET')
                .withHeaders(headers)
                .withParams(paramstr)
                .build()
            );

            return Bilibili.request(request);
        }

        /**
         * Check for lottery in room ``roomid``
         *
         * @static
         * @params  {Integer}   roomid
         * @params  {Object}    cookies - defaults to null
         * @returns {Promise}   resolve(json)   reject(String)
         */
        static getRaffleInRoom(roomid) {
            const params = { 'roomid': roomid, };
            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/xlive/lottery-interface/v1/lottery/Check')
                .withMethod('GET')
                .withHeaders(webHeaders)
                .withParams(params)
                .build()
            );

            return Bilibili.request(request);
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
         * @param   {Integer}   page    - page of the API, valid values: [1,2,3]
         * @returns {Promise}   resolve(json)   reject(String)
         */
        static getSailboatRooms(page) {
            // Page 1-3 (Rank 0-50)
            const page_size = 20;   // 必须是20
            const params = {
                'type': 'sail_boat_number',
                'page': page,
                'is_trend': 1,
                'page_size': page_size,
            };

            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/rankdb/v1/Rank2018/getWebTop')
                .withMethod('GET')
                .withParams(params)
                .withHeaders(webHeaders)
                .build()
            );

            return Bilibili.request(request);
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
            const params = {
                'date': 'month',
                'type': 'master_vitality_2018',
                'areaid': 0,
                'page': page,
                'is_trend': 1,
                'page_size': 20,
            };

            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/rankdb/v1/Rank2018/getWebTop')
                .withMethod('GET')
                .withParams(params)
                .withHeaders(webHeaders)
                .build()
            );

            return Bilibili.request(request);
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
                const pages = Number.parseInt(Math.round(room_count / page_size)) + 2;

                for (let i = 1; i < pages; ++i) {
                    params.page = i;

                    const request = (RequestBuilder.start()
                        .withHost('api.live.bilibili.com')
                        .withPath('/room/v3/area/getRoomList')
                        .withMethod('GET')
                        .withParams(params)
                        .withHeaders(webHeaders)
                        .build()
                    );

                    promises.push(new Promise((resolve, reject) => {

                        Bilibili.request(request).then((jsonObj) => {
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
            const params = {
                'parent_area_id': 0,
                'page': 1,
                'page_size': 1,
                'sort_type': 'live_time',
            };
            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/room/v3/area/getRoomList')
                .withMethod('GET')
                .withHeaders(webHeaders)
                .withParams(params)
                .build()
            );


            return Bilibili.request(request).then(jsonObj => {
                const count = jsonObj['data']['count'];
                return count;
            });
        }

        /**
         * Get gift configuration, including id, name, etc
         *
         * @static
         * @returns     {Promise}   resolve(json)   reject(String)
         */
        static getGiftConfig() {
            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/gift/v4/Live/giftConfig')
                .withMethod('GET')
                .withHeaders(webHeaders)
                .build()
            );

            return Bilibili.request(request);
        }

        /**
         * Get rooms in each of the six areas
         *
         * @static
         * @returns     {Promise}   resolve([ Array(Integer), Array(Integer), ... ])    reject(String)
         */
        static getRoomsInEachArea() {
            const params = {
                'parent_area_id': 0, 
                'page': 1, 
                'page_size': 10, 
                'sort_type': 'online', 
            };
            const areas = [ 1, 2, 3, 4, 5, 6, ];

            let promises = [];

            areas.forEach((areaid) => {

                params['parent_area_id'] = areaid;
                const request = (RequestBuilder.start()
                    .withHost('api.live.bilibili.com')
                    .withPath('/room/v3/area/getRoomList')
                    .withMethod('GET')
                    .withHeaders(webHeaders)
                    .withParams(params)
                    .build()
                );

                promises.push(Bilibili.request(request));

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
            const params = {
                'roomid': roomid,
                'ruid': uid,
                'page': 1,
                'page_size': 10,
            };

            if (uid !== null) {
                const request = (RequestBuilder.start()
                    .withHost('api.live.bilibili.com')
                    .withPath('/xlive/app-room/v1/guardTab/topList')
                    .withMethod('GET')
                    .withParams(params)
                    .withHeaders(webHeaders)
                    .build()
                );
                return Bilibili.request(request);
            }

            return Bilibili.getRoomInfo(roomid).then(resp => {
                const code = resp['code'];
                if (code !== 0) {
                    return Promise.reject(`Failed to getRoomInfo`);
                }
                params['ruid'] = resp['data']['uid'];
                const request = (RequestBuilder.start()
                    .withHost('api.live.bilibili.com')
                    .withPath('/xlive/app-room/v1/guardTab/topList')
                    .withMethod('GET')
                    .withParams(params)
                    .withHeaders(webHeaders)
                    .build()
                );
                return Bilibili.request(request);
            });
        }

        /**
         * Get basic info of a room
         *
         * @static
         * @param       {Integer}   roomid
         */
        static getRoomInfo(roomid) {
            const params = {
                'id': roomid, 
            };
            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/room/v1/Room/room_init')
                .withMethod('GET')
                .withParams(params)
                .withHeaders(webHeaders)
                .build()
            );

            return Bilibili.request(request);
        }

        /**
         * Check if a room is streaming
         *
         * @static
         * @param   {Integer}   roomid
         * @returns {Promise}   resolve(boolean)    reject(String)
         */
        static isLive(roomid) {
            return Bilibili.getRoomInfo(roomid).then((jsonObj) => {
                const isLive = jsonObj['data']['live_status'] === 1 ? true : false;
                return isLive;
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

    const xhr = Xhr.newSession();

    module.exports = Bilibili;

})();
