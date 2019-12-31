(function() {

    'use strict';

    const WebSocket = require('ws');

    const config = require('../global/config.js');

    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    const WSHost = require('./wshost.js');

    class WSHostBilive extends WSHost {

        constructor(host, port) {
            if (!host)
                host = config['wsServer']['bilive']['host'];
            if (!port)
                port = config['wsServer']['bilive']['port'];
            super(host, port);
        }

        printSuccess() {
            cprint(`WS server bilive listening on ${this.host}:${this.port}`, colors.green);
        }

        /**
         * @params      payload     String
         */
        broadcast(payload) {
            this.ws && this.ws.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(payload);
                }
            });
        }

        /**
         * @params      jsonObj     Object
         */
        parseMessage(jsonObj) {
            const toKey = {
                'id': 'id',
                'roomid': 'roomID',
                'name': 'title',
                'type': 'type',
            };

            const translated = {};
            Object.keys(jsonObj).forEach(key => {
                translated[toKey[key]] = jsonObj[key];
            });

            switch (jsonObj['type']) {
                case 'storm':
                    translated['cmd'] = 'beatStorm';
                    break;
                case 'guard':
                    translated['cmd'] = 'lottery';
                    break;
                case 'pk':
                    translated['cmd'] = 'pklottery';
                    break;
                default:
                    translated['cmd'] = 'raffle';
                    break;
            }

            const str = JSON.stringify(translated);

            return str;
        }
    }

    module.exports = WSHostBilive;

})();
