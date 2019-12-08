'use strict';

const net = require('net');
const EventEmitter = require('events').EventEmitter;

const UTF8ArrayToStr = require('../util/conversion.js').UTF8ArrayToStr;
const StrToUTF8Array = require('../util/conversion.js').StrToUTF8Array;
const roomidEmitter = require('../global/config.js').roomidEmitter;
const Bilibili = require('../bilibili.js');
const config = require('../global/config.js');
const wsUri = require('../global/config.js').wsUri;
const cprint = require('../util/printer.js');
const colors = require('colors/safe');

class BilibiliSocket extends EventEmitter {

    constructor(roomid, uid) {
        super();

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
            'platform': 'web',
            'clientver': '1.8.12',
        }));
        this.heartbeat = this.prepareData(2, '');
        this.heartbeatTask = null;

        this.buffer = Buffer.alloc(0);
        this.totalLength = -1;

        this.healthCheck = null;
        this.lastRead = 0;

        this.onData = this.onData.bind(this);
        this.onConnect = this.onConnect.bind(this);
        this.onMessage = this.onMessage.bind(this);
        this.onError = this.onError.bind(this);
        this.onClose = this.onClose.bind(this);
    }

    reset() {
        this.buffer = Buffer.alloc(0);
        this.totalLength = -1;
    }

    run() {
        this.reset();
        this.socket = net.createConnection({
            'host': this.host, 
            'port': this.port,
        }).setKeepAlive(true); // .setNoDelay(true)
        this.socket.on('connect', this.onConnect);
        this.socket.on('error', this.onError);
        this.socket.on('data', this.onData);
        this.socket.on('close', this.onClose);
    }

    onConnect() {
        if (config.verbose === true)
            cprint(`@room ${this.roomid} connected`, colors.green);
        this.socket && this.socket.write(this.handshake);
        this.healthCheck = setInterval(() => {
            if (+new Date() / 1000 - this.lastRead > 35)
                this.close(false);
        }, 45 * 1000);  // 每45秒检查读取状态 如果没读取到任何信息即重连
    }

    onError(error) {
        this.close(false);
        if (config.verbose === true)
            cprint(`@room ${this.roomid} observed an error: ${error.message}`, colors.red);
    }

    onData(buffer) {
        if (this.socket === null) {
            if (config.debug === true) 
                cprint(`${this.roomid} should be closed, socket is null`, colors.red);
            return;
        }
        this.lastRead = +new Date() / 1000;
        this.buffer = Buffer.concat([ this.buffer, buffer ]);
        if (this.totalLength <= 0 && this.buffer.length >= 4)
            this.totalLength = this.buffer.readUInt32BE(0);
        if (this.totalLength > 100000) {
            ++config.error['count'];
            if (config.error['count'] > 100) {
                cprint(`Fatal Error: 错误次数超过100 (${config.error['count']})`, colors.red);
                cprint(`Fatal Error: b站服务器拒绝连接`, colors.red);
                cprint(`程序终止`, colors.red);
                process.exit(1);
            }
            this.close();
        }
        if (config.debug === true)
            cprint(`BufferSize ${this.buffer.length} Length ${this.totalLength}`, colors.green);
        while (this.totalLength > 0 && this.buffer.length >= this.totalLength) {
            try {
                this.onMessage(this.buffer.slice(0, this.totalLength));
                this.buffer = this.buffer.slice(this.totalLength, this.buffer.length);
                if (this.buffer.length === 0) {
                    this.totalLength = 0;
                    if (this.buffer.length === 0) {
                        this.buffer = Buffer.alloc(0);
                    }
                } else if (this.buffer.length >= 4) {
                    this.totalLength = this.buffer.readUInt32BE(0);
                } else {
                    this.totalLength = -1;
                }
                if (config.debug === true)
                    cprint(`BufferSize ${this.buffer.length} Length ${this.totalLength}`, colors.green);
            } catch (error) {
                cprint(`Error: ${error.message} @room ${this.roomid}`, colors.red);
                config.debug = false;
                config.verbose = false;
                this.close(false);
                cprint(`[ 修正 ] TCP连接重启 @room ${this.roomid}`, colors.green);
                return;
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
            case 3:
                const popularity = buffer.readUInt32BE(headerLength);
                this.onPopularity(popularity);
                break;
            case 5:
                jsonStr = buffer.toString('utf8', headerLength, totalLength);
                msg = JSON.parse(jsonStr);
                this.processMsg(msg);
                break;
            case 8:
                if (this.heartbeatTask === null) {
                    this.heartbeatTask = setInterval(() => {
                        this.socket && this.socket.write(this.heartbeat);
                    }, 30 * 1000);
                }
                break;
        }
    }

    onClose() {
        const color = this.closed_by_user ? colors.green : colors.red;
        if (config.verbose === true)
            cprint(`@room ${this.roomid} lost connection.`, color);
        this.heartbeatTask && clearInterval(this.heartbeatTask);
        this.heartbeatTask = null;
        this.healthCheck && clearInterval(this.healthCheck);
        this.healthCheck = null;
        (this.socket 
            && this.socket.unref().end().destroy() 
            && this.socket.destroyed
            && (this.socket = null));
        if (this.closed_by_user === false) {
            this.run();
        } else {
            this.emit('close');
        }
    }

    close(closed_by_us=true) {
        this.closed_by_user = closed_by_us;
        this.heartbeatTask && clearInterval(this.heartbeatTask);
        this.heartbeatTask = null;
        this.healthCheck && clearInterval(this.healthCheck);
        this.healthCheck = null;
        (this.socket 
            && this.socket.unref().end().destroy() 
            && this.socket.destroyed
            && (this.socket = null));
    }

    processMsg(msg) {
        if (msg['scene_key'])
            msg = msg['msg'];

        let cmd = msg['cmd'];
        switch (cmd) {
            case 'NOTICE_MSG':
                if (config.verbose === true) 
                    cprint(msg['msg_common'], colors.cyan);
                this.onNoticeMsg(msg);
                break;
            case 'PREPARING':
                this.onPreparing(msg);
                break;
            case 'ROOM_CHANGE':
                this.onRoomChange(msg);
                break;
            default:
                break;
        }
    }

    onNoticeMsg(msg) {
    }

    onPreparing(msg) {
    }

    onRoomChange(msg) {
    }

    onPopularity(popularity) {
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

        const len = data.length;
        for (let i = 0; i < len; ++i) {
            buffer.writeUInt8(data[i], 16 + i);
        }

        return buffer;
    }

}

/**
 * 下播状态仍进行监听的房间 (大航海榜、元气榜)
 */
class FixedGuardMonitor extends BilibiliSocket {

    constructor(roomid, uid) {
        super(roomid, uid);
    }

    onNoticeMsg(msg) {

        const msg_type = msg['msg_type'];
        const roomid = msg['real_roomid'];
        
        switch (msg_type) {
            case 2:
                // fall through
            case 3:
                if (roomid === this.roomid) {
                    this.emitter && this.emitter.emit('gift', roomid);

                    if (msg_type === 3) this.onGuard(msg);
                }
                break;
        }
    }

    onGuard(msg) {}
}

/**
 * 下播5分钟(offTimes * 30)后关闭
 */
class GuardMonitor extends FixedGuardMonitor {

    constructor(roomid, uid) {
        super(roomid, uid);
        this.offTimes = 0;
        this.guardCount = 0;
        // 检测到10个以上的上舰信息转为Fixed
        // 不知道怎么转23333 (Event?)
    }

    onGuard(msg) {
        ++this.guardCount;
    }

    onPreparing(msg) {

        Bilibili.isLive(this.roomid).then((streaming) => {
            if (streaming === false) {
                super.close();
            }
        }).catch((error) => {
            cprint(`${Bilibili.isLive.name} - ${error}`, colors.red);
        });

    }

    onPopularity(popularity) {
        if (popularity <= 1) {
            ++this.offTimes;
            if (this.offTimes > 10) super.close();
        } else {
            this.offTimes = 0;
        }
    }

}

/**
 * 抽奖监听
 */
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
                this.emitter && this.emitter.emit('gift', roomid);
                break;
        }
    }

    onPreparing(msg) {
        if (this.areaid !== 0) {
            super.close();
        }
    }

    onRoomChange(msg) {
        const changedInfo = msg['data'];
        const newAreaid = changedInfo['parent_area_id'];
        if (this.areaid !== 0 && this.areaid !== newAreaid) {
            super.close();
        }
    }

    onPopularity(popularity) {
        if (popularity <= 1) {
            Bilibili.isLive(this.roomid).then(streaming => {
                if (streaming === false) {
                    super.close();
                }
            }).catch(error => {
                cprint(`${Bilibili.isLive.name} - ${error}`, colors.red);
            });
        }
    }

}

module.exports = {
    BilibiliSocket, 
    RaffleMonitor, 
    GuardMonitor, 
    FixedGuardMonitor,
};
