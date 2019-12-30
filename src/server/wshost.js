(function() {

    'use strict';

    const WebSocket = require('ws');

    const config = require('../global/config.js');

    const cprint = require('../util/printer.js');
    const colors = require('colors');

    class WSHost {

        constructor(host, port) {
            if (!host)
                this.host = config['wsServer']['self']['host'];
            else
                this.host = host;
            if (!port)
                this.port = config['wsServer']['self']['port'];
            else
                this.port = port;
            this.ws = null;
        }

        run() {
            try {
                this.listen(this.createServer());
            } catch (error) {
                cprint(`Failed to setup server: ${error.message}`, colors.red);
            }
        }

        createServer() {
            const ws = new WebSocket.Server({
                'host': this.host, 
                'port': this.port, 
                'perMessageDeflate': false, 
                'maxPayload': 4 * 1024, 
            });
            this.printSuccess();
            return ws;
        }

        printSuccess() {
            cprint(`WS server listening on ${this.host}:${this.port}`, colors.green);
        }

        listen(ws) {

            this.ws = ws;

            ws.on('connection', (socket, req) => {

                const proxy = req.headers['x-forwarded-for'];
                const remoteAddr = (
                    typeof proxy === 'undefined'
                    ? `${req.socket.remoteAddress}:${req.socket.remotePort}`
                    : `${proxy}`);
                cprint(`Client 连接建立于 @${remoteAddr}`, colors.brightBlue);

                socket.isAlive = true;
                socket.on('pong', () => {
                    socket.isAlive = true;
                });

                socket.on('message', (in_message) => {});

                socket.on('error', (error) => {
                    cprint(`Error: ${error.message}`, colors.red);
                    socket.close();
                });

            });

            ws.on('error', (error) => {
                ws.close(() => {
                    if (error.code === 'EADDRINUSE') {
                        cprint(`未能建立ws服务 - 端口${this.port}已被占用`, colors.red);
                        cprint('建议修改``settings.json``中的port值', colors.red);
                    } else {
                        cprint(`Error: ${error.message}`, colors.red);
                    }
                });
            });

            ws.on('close', () => {});

            const interval = setInterval(() => {
                ws.clients.forEach((client) => {
                    if (client.isAlive === false) return client.terminate();

                    client.isAlive = false;
                    client.ping(() => {});
                });
            }, 20 * 1000);
        }

        /**
         * @params Buffer payload
         */
        broadcast(payload) {
            this.ws && this.ws.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(payload, {
                        'binary': true, 
                    });
                }
            });
        }

        /**
         * @params Object jsonObj
         */
        parseMessage(jsonObj) {
            const str = JSON.stringify(jsonObj);
            const data = Buffer.from(str, 'utf8');

            return data;
        }
    }

    module.exports = WSHost;

})();
