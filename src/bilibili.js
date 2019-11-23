'use strict';

const colors = require('colors/safe');

const https = require('https');
const querystring = require('querystring');
const cprint = require('./util/printer.js');


/** Emits requests to the bilibili API */
class Bilibili {

    /** Check for lottery in room ``roomid``
     *
     */
    static getRaffleInRoom(roomid, callback, cookies=null) {
        const url = 'https://api.live.bilibili.com/xlive/lottery-interface/v1/lottery/Check';
        const params = {
            'roomid': roomid, 
        };
        const query = querystring.stringify(params);
        const headers = {
            'Cookie': cookies !== null ? cookies : {}, 
            'Connection': 'close', 
        };
        const options = {
            'headers': headers, 
        };

        https.get(`${url}?${query}`, options, (response) => {

            response.on('error', (error) => {});

            if (response.statusCode === 200) {

                let dataSequence = [];
                response.on('data', (data) => {
                    dataSequence.push(data);
                });
                response.on('end', () => {
                    const jsonStr = Buffer.concat(dataSequence).toString();
                    callback(roomid, jsonStr);
                });

            } else {

                cprint(
                    `Response code - ${response.statusCode}`, 
                    colors.red
                );
            }

        });
    }

    /** Get streaming entities in area ``areaid``
     *
     */
    static getRoomsInArea(areaid, size=99) {
        const url = 'https://api.live.bilibili.com/room/v3/area/getRoomList';
        const page_size = 99;
        const params = {
            'parent_area_id': areaid, 
            'page': 0, 
            'page_size': size > 99 || size < 0 ? size : 99, 
        };
        const headers = {
            'Connection': 'close', 
        };
        const options = {
            'headers': headers, 
        };

        let promises = [];

        const promise = new Promise((resolve_outer, reject_outer) => {

            Bilibili.getLiveCount((room_count) => {

                const page = Number.parseInt(room_count / page_size) + 1;
                let i = 0;
                
                while (i < page) {
                    params.page = i;
                    const query = querystring.stringify(params);
                    const x = i;

                    promises.push(new Promise((resolve, reject) => {

                        setTimeout(() => {

                            https.get(`${url}?${query}`, options, (response) => {

                                response.on('error', () => {});

                                if (response.statusCode === 200) {

                                    let dataSequence = [];
                                    response.on('data', (data) => {
                                        dataSequence.push(data);
                                    });
                                    response.on('end', () => {
                                        const jsonStr = Buffer.concat(dataSequence).toString();
                                        const jsonObj = JSON.parse(jsonStr);
                                        if (jsonObj['code'] !== 0) {
                                            reject({
                                                'code': jsonObj['code'], 
                                                'msg': jsonObj['msg'], 
                                                'reason': 'bilibili', 
                                            });
                                        } else {
                                            const rooms = jsonObj['data']['list'].map(entry => entry['roomid']);
                                            resolve(rooms);
                                        }
                                    });

                                } else {
                                    reject({
                                        'code': response.statusCode, 
                                        'reason': 'network', 
                                    });
                                }

                            });
                        }, i * 500);
                    }));
                    ++i;
                }
                resolve_outer(promises);
            });

        });

        return promise;
    }

    /**
     *
     */
    static getLiveCount(callback) {
        const url = 'https://api.live.bilibili.com/room/v3/area/getRoomList';
        const params = {
            'parent_area_id': 0, 
            'page': 1, 
            'page_size': 1, 
        };
        const query = querystring.stringify(params);
        const headers = {
            'Connection': 'close', 
        };
        const options = {
            'headers': headers, 
        };

        https.get(`${url}?${query}`, options, (response) => {

            response.on('error', () => {});

            if (response.statusCode === 200) {

                let dataSequence = [];
                response.on('data', (data) => {
                    dataSequence.push(data);
                });
                response.on('end', () => {
                    const jsonStr = Buffer.concat(dataSequence).toString();
                    const jsonObj = JSON.parse(jsonStr);
                    const count = jsonObj['data']['count'];
                    callback(count);
                });

            } else {

                console.log(colors.red(
                    `Response code - ${response.statusCode}`)
                );
            }

        });
    }
}

module.exports = Bilibili;

/**
 * options
 *  - method
 *  - headers
 */
