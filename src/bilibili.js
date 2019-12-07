'use strict';

const colors = require('colors/safe');

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


/** Emits requests to the bilibili API */
class Bilibili {

    static get(options) {

        let tries = 3;
        options['agent'] = httpsAgent;

        const doGet = (promise) => {
            return promise.catch((error) => {
                if (tries > 0) {
                    cprint(`${error}`, colors.red);
                    cprint(`[ 修正 ${3-tries} ]: 重现request`, colors.green);
                    --tries;
                    return doGet(newRequest());
                } else {
                    throw error;
                }
            });
        };
        const newRequest = () => new Promise((resolve, reject) => {

            https.get(options, (response) => {

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
            });
        });

        return doGet(newRequest());
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

        return Bilibili.get(options);
    }

    /** Get streaming entities in area ``areaid``
     *
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

        const promise = new Promise((resolve_outer, reject_outer) => {

            Bilibili.getLiveCount().then((room_count) => {

                room_count = Math.min(count, room_count);
                const page = Number.parseInt(Math.round(room_count / page_size)) + 2;
                let i = 1;
                
                while (i < page) {
                    params.page = i;
                    const query = querystring.stringify(params);
                    const options = {
                        'host': url, 
                        'path': `${path}?${query}`, 
                        'headers': headers, 
                    };
                    const x = i;

                    promises.push(new Promise((resolve, reject) => {

                        rateLimiter.get(options).then((jsonObj) => {
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
                            reject(error);
                        });

                    }));
                    ++i;
                }
                resolve_outer(promises);
            }).catch((error) => {
                reject_outer(error);
            });

        });

        // return promises;
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
            rateLimiter.get(options).then((jsonObj) => {
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

        return rateLimiter.get(options);
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

            promises.push(rateLimiter.get(options));

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
            rateLimiter.get(options).then((jsonObj) => {
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

/**
 * options
 *  - method
 *  - headers
 */
