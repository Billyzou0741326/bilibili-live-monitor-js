'use strict';

const net = require('net');
const EventEmitter = require('events').EventEmitter;

const cprint = require('../util/printer.js');
const colors = require('colors/safe');

const Bilibili = require('../bilibili.js');
const config = require('../global/config.js');
const wsUri = require('../global/config.js').wsUri;
const GiftBuilder = require('../handler/gift.js');
const GuardBuilder = require('../handler/guard.js');

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
                    this.socket.write(this.heartbeat);
                    this.heartbeatTask = setInterval(() => {
                        this.socket && this.socket.write(this.heartbeat);
                    }, 30 * 1000);
                }
                break;
        }
    }

    processMsg(msg) {
    }

    onPopularity(popularity) {
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
        return super.run();
    }

    processMsg(msg) {
        if (msg['scene_key'])
            msg = msg['msg'];

        let cmd = msg['cmd'];
        switch (cmd) {
            case 'GUARD_LOTTERY_START':
                this.onGuard(msg);
                break;
            case 'TV_START':
                this.onTV(msg);
                break;
            case 'RAFFLE_START':
                this.onRaffle(msg);
                break;
            case 'SPECIAL_GIFT':
                this.onSpecialGift(msg);
                break;
            case 'PK_LOTTERY_START':
                this.onPkLottery(msg);
                break;
            case 'ANCHOR_LOT_START':
                this.onAnchorLottery(msg);
                break;
            case 'NOTICE_MSG':
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

    onRaffle(msg) {
        const data = msg['data'];
        const dataOk = typeof data !== 'undefined';

        let gift = null;
        if (dataOk) {
            const type = data['type'];
            const id = data['raffleId'];
            const name = data['title'] || '未知';
            const wait = data['time_wait'];
            const expireAt = data['time'] + Number.parseInt(0.001 * new Date());
            gift = (GiftBuilder.start()
                .withId(id)
                .withRoomid(this.roomid)
                .withType(type)
                .withName(name)
                .withWait(wait)
                .withExpireAt(expireAt)
                .build());
        }

        return gift;
    }

    onTV(msg) {
        const data = msg['data'];
        const dataOk = typeof data !== 'undefined';

        let gift = null;
        if (dataOk) {
            const type = data['type'];
            const id = data['raffleId'];
            const name = data['title'] || '未知';
            const wait = data['time_wait'];
            const expireAt = data['time'] + Number.parseInt(0.001 * new Date());
            gift = (GiftBuilder.start()
                .withId(id)
                .withRoomid(this.roomid)
                .withType(type)
                .withName(name)
                .withWait(wait)
                .withExpireAt(expireAt)
                .build());
        }

        return gift;
    }

    onGuard(msg) {
        const data = msg['data'];
        const dataOk = typeof data !== 'undefined';

        const nameOfType = {
            1: '总督',
            2: '提督',
            3: '舰长',
        };

        let guard = null;
        if (dataOk) {
            const lottery = data['lottery'];
            const lotteryOk = typeof lottery !== 'undefined';

            const type = data['type'];
            const id = data['id'];
            const name = nameOfType[data['privilege_type']];
            const expireAt = ((lotteryOk || 0) && lotteryOk['time']) + Number.parseInt(0.001 * new Date());
            guard = (GuardBuilder.start()
                .withId(id)
                .withRoomid(this.roomid)
                .withType(type)
                .withName(name)
                .withExpireAt(expireAt)
                .build());
        }

        return guard;
    }

    onAnchorLottery(msg) {
        const data = msg['data'];
        const dataOk = typeof data !== 'undefined';

        let details = null;
        if (dataOk) {
            const name = data['award_name'];
            const roomid = data['room_id'];
            const price = data['gift_price'];
            const num = data['gift_num'];
            details = {
                name,
                roomid,
                price,
                num,
            };
        }

        return details;
    }

    onPkLottery(msg) {
    }

    onSpecialGift(msg) {
        const data = msg['data'];
        const dataOk = typeof data !== 'undefined';

        if (!dataOk) return null;

        const info = data['39'];
        const infoOk = typeof info !== 'undefined';
        if (!infoOk) return null;

        let details = null;
        if (info['action'] === 'start') {
            const id = info['id'];
            details = {
                'id': id,
                'roomid': this.roomid,
                'type': 'storm',
                'name': '节奏风暴',
            };
        }

        return details;
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

    run() {
        return super.run();
    }

    onRaffle(msg) {
        const raffleData = super.onRaffle(msg);
        if (raffleData !== null)
            setTimeout(() => this.emit('gift', raffleData), raffleData['wait'] * 1000);
        return raffleData;
    }

    onPkLottery(msg) {
        const data = msg['data'];
        if (data !== null)
            this.emit('roomid', this.roomid);
        return data;
    }

    onGuard(msg) {
        const guardData = super.onGuard(msg);
        if (guardData !== null)
            this.emit('guard', guardData);
        return guardData;
    }

    onSpecialGift(msg) {
        const stormData = super.onSpecialGift(msg);
        if (stormData !== null)
            this.emit('storm', stormData);
        return stormData;
    }
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
        let result = super.onGuard(msg);
        ++this.guardCount;
        if (this.toFixed()) {
            this.close();
        }
        return result;
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
