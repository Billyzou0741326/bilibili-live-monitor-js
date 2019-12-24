'use strict';

const net = require('net');
const EventEmitter = require('events').EventEmitter;

const Bilibili = require('../bilibili.js');
const config = require('../global/config.js');
const wsUri = require('../global/config.js').wsUri;
const cprint = require('../util/printer.js');
const colors = require('colors/safe');

class AbstractBilibiliTCP extends EventEmitter {

    constructor(roomid) {
        super();
        this.setMaxListeners(15);

        this.host = wsUri.host;
        this.port = wsUri.port;

        this.roomid = roomid || 0;
        this.socket = null;
        this.closed_by_user = false;

        this.handshake = this.prepareData(7, JSON.stringify({
            'roomid': this.roomid, 
            'platform': 'web',
            'clientver': '1.8.12',
        }));
        this.heartbeat = this.prepareData(2, '');
        this.heartbeatTask = null;
        this.healthCheck = null;

        this.buffer = Buffer.alloc(0);
        this.totalLength = -1;

        this.lastRead = 0;


        this.bind();
    }

    bind() {
        this.onData = this.onData.bind(this);
        this.onConnect = this.onConnect.bind(this);
        this.onMessage = this.onMessage.bind(this);
        this.onError = this.onError.bind(this);
        this.onClose = this.onClose.bind(this);
    }

    reset() {
        this.heartbeatTask && clearInterval(this.heartbeatTask);
        this.heartbeatTask = null;
        this.healthCheck && clearInterval(this.healthCheck);
        this.healthCheck = null;
        (this.socket 
            && this.socket.unref().end().destroy() 
            && (this.socket = null));
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
        this.socket && this.socket.write(this.handshake);
        this.healthCheck = setInterval(() => {
            if (+new Date() - this.lastRead > 35 * 1000)
                this.close(false);
        }, 45 * 1000);  // 每45秒检查读取状态 如果没读取到任何信息即重连
    }

    onError(error) {
    }

    close(closed_by_us=true) {
        this.closed_by_user = closed_by_us;
        this.reset();
    }

    onClose() {
        this.reset();
        if (this.closed_by_user === false) {
            this.run();
        } else {
            this.emit('close');
        }
    }

    onData(buffer) {
        this.lastRead = +new Date();
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
                    this.buffer = Buffer.alloc(0);
                } else if (this.buffer.length >= 4) {
                    this.totalLength = this.buffer.readUInt32BE(0);
                } else {
                    this.totalLength = -1;
                }
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
    }

    prepareData(cmd, str) {

        const bufferBody = Buffer.from(str, 'utf8');
        const headerLength = 16;
        const totalLength = headerLength + bufferBody.length;

        const bufferHeader = Buffer.alloc(16);
        bufferHeader.writeUInt32BE(totalLength, 0);
        bufferHeader.writeUInt16BE(headerLength, 4);
        bufferHeader.writeUInt16BE(1, 6);
        bufferHeader.writeUInt32BE(cmd, 8);
        bufferHeader.writeUInt32BE(1, 12);

        const buffer = Buffer.concat([ bufferHeader, bufferBody ]);

        return buffer;
    }
}

class BilibiliSocket extends AbstractBilibiliTCP {

    constructor(roomid) {
        super(roomid);
    }

    run() {
        super.run();
    }

    onMessage(buffer) {
        super.onMessage(buffer);
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

    processMsg(msg) {
        if (msg['scene_key'])
            msg = msg['msg'];

        let cmd = msg['cmd'];
        switch (cmd) {
            case 'NOTICE_MSG':
                this.onNoticeMsg(msg);
                break;
            case 'SPECIAL_GIFT':
                this.onSpecialGift(msg);
                break;
            case 'ANCHOR_LOT_START':
                break;
                this.onAnchor(msg);
            case 'PK_LOTTERY_START':
                this.onPkLottery(msg);
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

    onGuard(msg) {
        this.emit('guard');
    }

    onAnchor(msg) {
    }

    onPkLottery(msg) {
    }

    onSpecialGift(msg) {
    }

    onNoticeMsg(msg) {
    }

    onPreparing(msg) {
    }

    onRoomChange(msg) {
    }

    onPopularity(popularity) {
    }

}

/**
 * 下播状态仍进行监听的房间 (大航海榜、元气榜)
 */
class FixedGuardMonitor extends BilibiliSocket {

    constructor(roomid) {
        super(roomid);
    }

    onAnchor(msg) {
        const data = msg['data'];
        this.emit('anchor', this.roomid);
    }

    onPkLottery(msg) {
        const data = msg['data'];
        this.emit('roomid', this.roomid);
    }

    onGuard(msg) {
        super.onGuard(msg);
    }

    onSpecialGift(msg) {
        try {
            const data = msg['data']['39'];

            if (typeof data !== 'undefined' && data['action'] === 'start') {
                const id = data['id'];
                const details = {
                    'id': id,
                    'roomid': this.roomid,
                    'type': 'storm',
                    'name': '节奏风暴',
                };
                this.emit('storm', details);
            }
        } catch (error) {
            cprint(`Error: ${error.message} - ${JSON.stringify(msg)}`, colors.red);
        }
    }

    onNoticeMsg(msg) {

        const msg_type = msg['msg_type'];
        const roomid = msg['real_roomid'];
        
        switch (msg_type) {
            case 2:
                // fall through
            case 3:
                if (roomid === this.roomid) {
                    this.emit('roomid', roomid);

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

    constructor(roomid) {
        super(roomid);
        this.offTimes = 0;
        this.guardCount = 0;
    }

    toFixed() {
        return this.guardCount > 1;
    }

    onGuard(msg) {
        super.onGuard(msg);
        ++this.guardCount;
        if (this.toFixed()) {
            this.close();
        }
    }

    onPreparing(msg) {

        Bilibili.isLive(this.roomid).then((streaming) => {
            if (streaming === false) {
                this.close();
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

    constructor(roomid, areaid=0) {
        super(roomid);
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
                this.emit('roomid', roomid);
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
