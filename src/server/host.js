'use strict';

const net = require('net');
const WebSocket = require('ws');

const config = require('../global/config.js');
const { raffleEmitter } = require('../global/config.js');

const cprint = require('../util/printer.js');
const colors = require('colors');

class Host {

    constructor(host, port) {
        if (!host) this.host = config['wsServer']['host'];
        if (!port) this.port = config['wsServer']['port'];
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
        cprint(`WS server listening on ${this.host}:${this.port}`, colors.green);
        const ws = new WebSocket.Server({
            'host': this.host, 
            'port': this.port, 
            'perMessageDeflate': false, 
            'maxPayload': 4 * 1024, 
        });
        return ws;
    }

    listen(ws) {

        this.ws = ws;

        ws.on('connection', (socket) => {

            socket.isAlive = true;
            socket.on('pong', () => {
                socket.isAlive = true;
            });

            socket.on('message', (in_message) => {
                const accepted = Buffer.alloc(16);
                accepted.writeUInt32BE(16, 0);
                accepted.writeUInt16BE(16, 4);
                accepted.writeUInt16BE(1, 6);
                accepted.writeUInt32BE(8, 8);
                accepted.writeUInt32BE(1, 12);
                socket.send(accepted);

            });

            socket.on('error', (error) => {
                cprint(`Error: ${error.message}`, colors.red);
                socket.close();
            });

        });

        ws.on('error', (error) => {
            ws.close(() => {
                if (error.code === 'EADDRINUSE') {
                    cprint(`未能建立服务器 - 端口${this.port}已被占用`, colors.red);
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

        raffleEmitter
            .on('gift', (gift) => {

                this.broadcast(this.parseMessage(gift));
            })
            .on('guard', (guard) => {

                this.broadcast(this.parseMessage(guard));
            })
            .on('pk', (pk) => {

                this.broadcast(this.parseMessage(pk));
            })
            .on('storm', (storm) => {

                this.broadcast(this.parseMessage(storm));
            });
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

        const header = Buffer.alloc(16);
        header.writeUInt32BE(16 + data.length, 0);
        header.writeUInt16BE(16, 4);
        header.writeUInt16BE(1, 6);
        header.writeUInt32BE(5, 8);
        header.writeUInt32BE(1, 12);

        const payload = Buffer.concat([ header, data ]);
        return payload;
    }
}

module.exports = Host;
