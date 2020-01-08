(function() {

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


    const Danmu = {
        'GIFT':     0b00000001,
        'GUARD':    0b00000010,
        'STORM':    0b00000100,
        'PK':       0b00001000,
        'ANCHOR':   0b00010000,
    };


    /** Handles connection/reconnection/heartbeat/data-processing  */
    class AbstractBilibiliTCP extends EventEmitter {

        /**
         * @constructor
         * @param   {Integer}   roomid
         */
        constructor(roomid) {
            super();

            this.bind();

            this.setMaxListeners(15);

            this.host = wsUri.host;
            this.port = wsUri.port;

            this.roomid = roomid || 0;
            this.socket = null;
            this.closed_by_user = false;

            // Pre-establish handshake and heartbeat.
            // These need not be modified
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
        }

        /**
         * Binds callbacks to `this` object
         */
        bind() {
            this.onData = this.onData.bind(this);
            this.onConnect = this.onConnect.bind(this);
            this.onMessage = this.onMessage.bind(this);
            this.onError = this.onError.bind(this);
            this.onClose = this.onClose.bind(this);
        }

        /**
         * Resets all fields for new connection, terminate current connection
         */
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

        /**
         * Establish a new tcp connection
         */
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

        /**
         * Writes handshake upon connection open
         * Performs health check periodically
         */
        onConnect() {
            this.socket && this.socket.write(this.handshake);
            this.healthCheck = setInterval(() => {
                if (new Date() - this.lastRead > 35000) {
                    this.close(false);
                }
            }, 5 * 1000);
        }

        onError(error) {
        }

        /**
         * Performs closing action
         *
         * @param   {boolean}   closed_by_us    - whether closed by user or not
         */
        close(closed_by_us=true) {
            this.closed_by_user = closed_by_us;
            this.reset();
        }

        /**
         * Upon closing, reset socket, optionally emits close event
         */
        onClose() {
            this.reset();
            if (this.closed_by_user === false) {
                this.run();
            } else {
                this.emit('close');
            }
        }

        /**
         * Parsing a single message
         * @param   {Buffer}    buffer  - for Network I/O
         */
        onData(buffer) {
            this.lastRead = +new Date();
            this.buffer = Buffer.concat([ this.buffer, buffer ]);
            if (this.totalLength <= 0 && this.buffer.length >= 4)
                this.totalLength = this.buffer.readUInt32BE(0);
            if (this.totalLength > 100000) {
                ++config.error['count'];
                if (config.error['count'] > 100) {
                    cprint(`Fatal Error: errored >100 (${config.error['count']})`, colors.red);
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
                    cprint(`(TCP) Connection reset @room ${this.roomid}`, colors.green);
                    return;
                }
            }
        }

        /**
         * Upon receiving a complete message, decode and handle tasks
         *
         * @param   {Buffer}    buffer  - Complete message
         */
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

        /**
         * @param   {Object}    msg
         */
        processMsg(msg) {
        }

        /**
         * @param   {Integer}   popularity  - # watching stream
         */
        onPopularity(popularity) {
        }

        /**
         * @param   {Integer}   cmd     - cmd for bilibili danmu protocol
         * @param   {String}    str     - String data to parse
         * @returns {Buffer}    parsed data in BigEndian format
         */
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


    /** TCP connection message categorizing */
    class BilibiliTCP extends AbstractBilibiliTCP {

        /**
         * @constructor
         * @param       {Integer}   roomid
         * @param       {Integer}   targets
         */
        constructor(roomid, targets=0b11111111) {
            super(roomid);
            this.targets = targets;
            this.peak_popularity = 0;
        }

        /**
         * Establishes connection
         */
        run() {
            return super.run();
        }

        /**
         * Handle message according to categories
         */
        processMsg(msg) {
            if (msg['scene_key'])
                msg = msg['msg'];

            let cmd = msg['cmd'];
            switch (cmd) {
                case 'GUARD_LOTTERY_START':
                    if ((this.targets & Danmu.GUARD) === Danmu.GUARD)
                        this.onGuard(msg);
                    break;
                case 'TV_START':
                    if ((this.targets & Danmu.GIFT) === Danmu.GIFT)
                        this.onTV(msg);
                    break;
                case 'RAFFLE_START':
                    if ((this.targets & Danmu.GIFT) === Danmu.GIFT)
                        this.onRaffle(msg);
                    break;
                case 'SPECIAL_GIFT':
                    if ((this.targets & Danmu.STORM) === Danmu.STORM)
                        this.onSpecialGift(msg);
                    break;
                case 'PK_LOTTERY_START':
                    if ((this.targets & Danmu.PK) === Danmu.PK)
                        this.onPkLottery(msg);
                    break;
                case 'ANCHOR_LOT_START':
                    if ((this.targets & Danmu.ANCHOR) === Danmu.ANCHOR)
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

        /**
         * @param   {Object}    msg
         * @param   {String}    msg.cmd
         * @param   {Object}    msg.data
         * @param   {Integer}   msg.data.raffleId
         * @param   {Integer}   msg.data.time
         * @param   {Integer}   msg.data.time_wait
         * @param   {String}    msg.data.type
         * @param   {String}    msg.data.title
         * @returns {Gift}      gift info
         */
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

        /**
         * @param   {Object}    msg
         * @param   {String}    msg.cmd
         * @param   {Object}    msg.data
         * @param   {Integer}   msg.data.raffleId
         * @param   {Integer}   msg.data.time
         * @param   {Integer}   msg.data.time_wait
         * @param   {String}    msg.data.type
         * @param   {String}    msg.data.title
         * @returns {Gift}      gift info
         */
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

        /**
         * @param   {Object}    msg
         * @param   {String}    msg.cmd
         * @param   {Object}    msg.data
         * @param   {Integer}   msg.data.id
         * @param   {Integer}   msg.data.privilege_type
         * @param   {String}    msg.data.type
         * @param   {Object}    msg.data.lottery
         * @param   {Integer}   msg.data.lottery.time
         * @returns {Guard}     guard info
         */
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
                const lottery = data['lottery'] || {};
                const lotteryOk = typeof lottery !== 'undefined';

                const type = data['type'];
                const id = data['id'];
                const name = nameOfType[data['privilege_type']];
                const expireAt = (lottery['time'] || 0) + Number.parseInt(0.001 * new Date());
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

        /**
         * @returns     {Object}    .name .roomid .price .num
         */
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
            // TODO:
            return null;
        }

        /**
         * @returns     {Object}    .id .roomid .type .name
         */
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
            let result = super.onPopularity(popularity);
            this.peak_popularity = Math.max(this.peak_popularity, popularity);
            this.peak_popularity = this.peak_popularity || 0;
            return result;
        }

    }

    /** Never closes, persist connection */
    class FixedGuardMonitor extends BilibiliTCP {

        /**
         * @constructor
         * @param       {Integer}   roomid
         * @param       {Integer}   targets     - see BilibiliTCP
         */
        constructor(roomid, targets) {
            if (Number.isInteger(targets) === false)
                targets = Danmu.GIFT | Danmu.STORM | Danmu.PK | Danmu.GUARD;
            super(roomid, targets);
        }

        /**
         * Establishes connection
         */
        run() {
            return super.run();
        }

        /**
         * If raffle is valid, wait and emit 'gift'
         *
         * @param       {Object}    msg
         */
        onRaffle(msg) {
            const raffleData = super.onRaffle(msg);
            if (raffleData !== null) {
                this.emit('add_to_db');
                setTimeout(() => this.emit('gift', raffleData), raffleData['wait'] * 1000);
            }
            return raffleData;
        }

        /**
         * If pk is valid, wait and emit
         */
        onPkLottery(msg) {
            // TODO
            const data = msg['data'];
            if (data !== null) {
                this.emit('add_to_db');
                this.emit('roomid', this.roomid);
            }
            return data;
        }

        /**
         * If valid, emit 'guard'
         *
         * @param       {Object}    msg
         */
        onGuard(msg) {
            const guardData = super.onGuard(msg);
            if (guardData !== null) {
                this.emit('add_to_db');
                this.emit('guard', guardData);
            }
            return guardData;
        }

        /**
         * If valid, emit 'storm'
         *
         * @param       {Object}    msg
         */
        onSpecialGift(msg) {
            const stormData = super.onSpecialGift(msg);
            if (stormData !== null) {
                this.emit('add_to_db');
                this.emit('storm', stormData);
            }
            return stormData;
        }
    }

    /** Closes after 5 minutes of being offline */
    class GuardMonitor extends FixedGuardMonitor {

        /**
         * @constructor
         * @param       {Integer}   roomid
         * @param       {Integer}   targets     - See BilibiliTCP
         */
        constructor(roomid) {
            const targets = Danmu.GIFT | Danmu.STORM | Danmu.PK | Danmu.GUARD;
            super(roomid, targets);
            this.offTimes = 0;
            this.newAnchorCount = 0;
            this.newStormCount = 0;
            this.newGuardCount = 0;
            this.newGiftCount = 0;
            this._toFixed = false;
        }

        run() {
            super.run();
        }

        /**
         * Checks if this room has more than ${count} guards
         *
         * @param       {Integer}   count   - guard count
         * @returns     {Promise}   resolve(boolean)
         */
        hasGuardsMoreThan(count) {
            return Bilibili.getGuardList(this.roomid).then(resp => {
                const code = resp['code'];
                if (code === 0) {
                    const data = resp['data'];
                    const info = data && data['info'];
                    if (info && info['num'] > count) {
                        return true;
                    }
                }
                return false;
            }).catch(error => {
                cprint(`Error: ${Bilibili.getGuardList} - ${error}`, colors.red);
                return Promise.resolve(false);
            });
        }

        toFixed() {
            return (
                this.newGuardCount > 0
                || this.newGiftCount > 1
                || this.newStormCount > 0
                || this.newAnchorCount > 0
                || this._toFixed);
        }

        onAnchorLottery(msg) {
            const result = super.onAnchorLottery(msg);
            if (result !== null) {
                ++this.newAnchorCount;
            }
            return result;
        }

        onRaffle(msg) {
            const result = super.onRaffle(msg);
            if (result !== null) {
                ++this.newGiftCount;
            }
            return result;
        }

        onTV(msg) {
            const result = super.onTV(msg);
            if (result !== null) {
                ++this.newGiftCount;
            }
            return result;
        }

        onGuard(msg) {
            const result = super.onGuard(msg);
            if (result !== null) {
                ++this.newGuardCount;
            }
            return result;
        }

        /**
         * If popularity renders too low for 10 heartbeats (~5 min)
         *      - Check if streaming, if not then:
         *          - Check peak_popularity during stream, >50000 mark as to_fixed
         *          - Close connection
         *      - Otherwise, it's streaming:
         *          - Clear the offTimes counter to 0
         */
        onPopularity(popularity) {
            let result = super.onPopularity(popularity);

            if (popularity <= 1) {
                ++this.offTimes;
                if (this.offTimes > 10) {

                    Bilibili.isLive(this.roomid).then(streaming => {

                        if (streaming === true) {
                            this.offTimes = 0;
                            return null;
                        }

                        if (this.peak_popularity > 50000) {
                            this._toFixed = true;
                        }
                        this.close();
                    });
                }
            } else {
                this.offTimes = 0;
            }

            return result;
        }

    }

    /**
     * Area listener
     */
    class RaffleMonitor extends BilibiliTCP {

        constructor(roomid, areaid=0) {
            const targets = Danmu.GIFT;
            super(roomid, targets);
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
                        this.close();
                    }
                }).catch(error => {
                    cprint(`${Bilibili.isLive.name} - ${error}`, colors.red);
                });
            }
        }

    }

    module.exports = {
        Danmu,
        BilibiliTCP, 
        RaffleMonitor, 
        GuardMonitor, 
        FixedGuardMonitor,
    };

})();
