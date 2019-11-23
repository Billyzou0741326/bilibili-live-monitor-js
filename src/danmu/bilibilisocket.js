'use strict';

const net = require('net');

const UTF8ArrayToStr = require('../util/conversion.js').UTF8ArrayToStr;
const StrToUTF8Array = require('../util/conversion.js').StrToUTF8Array;
const roomidEmitter = require('../global/config.js').roomidEmitter;
const verbose = require('../global/config.js').verbose;
const wsUri = require('../global/config.js').wsUri;
const cprint = require('../util/printer.js');
const colors = require('colors/safe');

class BilibiliSocket {

    constructor(roomid, uid) {
        this.host = wsUri.host;
        this.port = wsUri.port;

        this.roomid = roomid;
        this.uid = uid;
        this.socket = null;
        this.emitter = roomidEmitter;
        this.closed_by_user = false;

        this.handshake = this.prepareData(7, JSON.stringify({
            'roomid': this.roomid, 
            'uid': this.uid, 
        }));
        this.heartbeat = this.prepareData(2, '');
        this.heartbeatTask = null;

        this.buffers = [];
        this.position = 0;
        this.totalLength = 0;
    }

    run() {
        this.socket = net.createConnection({
            'host': this.host, 
            'port': this.port,
        }).setKeepAlive(true); // .setNoDelay(true)
        this.socket.on('connect', this.onConnect.bind(this));
        this.socket.on('error', this.onError.bind(this));
        this.socket.on('data', this.onData.bind(this));
        this.socket.on('close', this.onClose.bind(this));
    }

    onConnect() {
        if (verbose === true)
            cprint(`@room ${this.roomid} connected`, colors.green);
        this.socket && this.socket.write(this.handshake);
    }

    onError(error) {
        if (verbose === true)
            cprint(`@room ${this.roomid} observed an error: ${error.message}`, colors.red);
    }

    onData(buffer) {
        this.buffers.push(buffer);
        this.buffers = [ Buffer.concat(this.buffers) ];
        if (this.position <= 0) {
            this.totalLength = this.buffers[0].readUInt32BE(0);
            this.position = this.buffers[0].length;
            while (this.totalLength > 0 && this.position >= this.totalLength) {
                this.onMessage(this.buffers[0].slice(0, this.totalLength));
                this.buffers = [
                    this.buffers[0].slice(this.totalLength, this.buffers[0].length) ];
                this.position -= this.totalLength;
                if (this.position === 0) {
                    this.totalLength = 0;
                    this.buffers = [];
                } else {
                    this.totalLength = this.buffers[0].readUInt32BE(0);
                }
            }
        }
    }

    onMessage(buffer) {
        const totalLength = buffer.readUInt32BE(0);
        const headerLength = buffer.readUInt16BE(4);
        const cmd = buffer.readUInt32BE(8);

        let jsonStr = '';
        let msg = null;
        switch (cmd) {
            case 5:
                jsonStr = buffer.toString('utf8', headerLength, totalLength);
                msg = JSON.parse(jsonStr);
                this.processMsg(msg);
                break;
            case 8:
                this.heartbeatTask = setInterval(() => {
                    this.socket && this.socket.write(this.heartbeat);
                }, 30 * 1000);
        }
    }

    onClose() {
        const color = this.closed_by_user ? colors.green : colors.red;
        if (verbose === true)
            cprint(`@room ${this.roomid} lost connection.`, color);
        this.heartbeatTask && clearInterval(this.heartbeatTask);
        this.heartbeatTask = null;
        this.socket && this.socket.unref().end().destroy();
        this.socket = null;
        if (this.closed_by_user === false) {
            this.run();
        }
    }

    close() {
        this.closed_by_user = true;
        this.heartbeatTask && clearInterval(this.heartbeatTask);
        this.heartbeatTask = null;
        this.socket && this.socket.unref().end().destroy();
        this.socket = null;
    }

    processMsg(msg) {
        if (msg['scene_key'])
            msg = msg['msg'];

        let cmd = msg['cmd'];
        switch (cmd) {
            case 'NOTICE_MSG':
                this.onNoticeMsg(msg);
                break;
            case 'PREPARING':
                break;
        }
    }

    onNoticeMsg(msg) {
    }

    prepareData(cmd, str) {
        const data = StrToUTF8Array(str);
        const headerLength = 16;
        const totalLength = headerLength + data.length;
        
        const buffer = Buffer.alloc(totalLength);
        buffer.writeUInt32BE(totalLength, 0);
        buffer.writeUInt16BE(headerLength, 4);
        buffer.writeUInt16BE(1, 6);
        buffer.writeUInt32BE(cmd, 8);
        buffer.writeUInt32BE(1, 12);

        for (let i = 0; i < data.length; ++i) {
            buffer.writeUInt8(data[i], 16 + i);
        }

        return buffer;
    }

}

class GuardMonitor extends BilibiliSocket {

    constructor(roomid, uid) {
        super(roomid, uid);
    }

    onNoticeMsg(msg) {

        const msg_type = msg['msg_type'];
        const roomid = msg['real_roomid'];
        
        switch (msg_type) {
            case 3:
                if (roomid === this.roomid) {
                    if (verbose === true)
                        cprint(`${this.roomid} - ${msg['msg_common']}`, colors.green);
                    this.emitter && this.emitter.emit('gift', roomid);
                }
                break;
        }
    }

}

class RaffleMonitor extends BilibiliSocket {

    constructor(roomid, uid, areaid=0) {
        super(roomid, uid);
        this.areaid = areaid;
    }

    onNoticeMsg(msg) {

        const msg_type = msg['msg_type'];
        const roomid = msg['real_roomid'];

        
        switch (msg_type) {
            case 2:
                // fall through
            case 6:
                // fall through
            case 8:
                if (verbose === true)
                    cprint(`${this.roomid} - ${msg['msg_common']} - ${msg_type}`, colors.green);
                this.emitter && this.emitter.emit('gift', roomid);
                break;
        }
    }

}

module.exports = {
    BilibiliSocket, 
    RaffleMonitor, 
    GuardMonitor, 
};
