'use strict';

const net = require('net');
const WebSocket = require('ws');

const settings = require('../settings.json');
const { raffleEmitter } = require('../global/config.js');

const cprint = require('../util/printer.js');
const colors = require('colors');

class Host {

    constructor(host, port) {
        if (!host) this.host = settings['server']['ip'];
        if (!port) this.port = settings['server']['port'];
    }

    run() {
        try {
            this.listen();
        } catch (error) {
            cprint(`Failed to setup server: ${error.message}`, colors.red);
        }
    }

    listen() {
        const ws = new WebSocket.Server({
            'host': this.host, 
            'port': this.port, 
            'perMessageDeflate': false, 
            'maxPayload': 8 * 1024, 
        });

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

        });

        ws.on('error', (error) => {
            ws.close(() => {
                cprint(`Error: ${error.message}`, colors.red);
                cprint('未能建立服务器 - 可能原因: 接口已被占用', colors.red);
                cprint('建议修改``settings.json``中的port值', colors.red);
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

        raffleEmitter.on('gift', (gift) => {

            const payload = this.parseMessage(gift);

            ws.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(payload, {
                        'binary': true, 
                    });
                }
            });
        });

        raffleEmitter.on('guard', (guard) => {

            const payload = this.parseMessage(guard);

            ws.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(payload, {
                        'binary': true, 
                    });
                }
            });
        });
    }

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
