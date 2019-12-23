'use strict';

const colors = require('colors/safe');

const emitter = require('../global/config.js').raffleEmitter;
const cprint = require('../util/printer.js');

class RaffleHandler {

    /**
     * @params  options     Object
     *          db          Database
     *          history     History
     */
    constructor(options={}) {
        this.installed = false;
        this.emitter = emitter;

        if (options) {
            const { db, history } = options;
            this.db = db || null;
            this.history = history || null;
        }
        
        this.bind();
    }

    run() {
        this.listen();
    }

    bind() {
        this.onGuard = this.onGuard.bind(this);
        this.onGift = this.onGift.bind(this);
        this.onStorm = this.onStorm.bind(this);
        this.onPK = this.onPK.bind(this);
    }

    listen() {
        if (this.installed === false && this.emitter) {
            this.installed = true;

            this.emitter
                .on('guard', this.onGuard)
                .on('gift', this.onGift)
                .on('storm', this.onStorm)
                .on('pk', this.onPK);
        }
    }

    onGuard(guard) {
        const valid = this.checkUnique(guard, 'guard');
        if (valid) {
            cprint(
                `${guard.id.toString().padEnd(13)}`
                + `@${guard.roomid.toString().padEnd(13)}`
                + `${guard.type.padEnd(13)}`
                + `${guard.name}`, 
                colors.cyan
            );
            this.db && this.db.update(guard.roomid, 'guard');
            this.history && this.history.addGift(guard);
            this.emitter.emit('any', guard);
        }
    }

    onGift(gift) {
        const valid = this.checkUnique(gift, 'gift');
        if (valid) {
            cprint(
                `${gift.id.toString().padEnd(13)}`
                + `@${gift.roomid.toString().padEnd(13)}`
                + `${gift.type.padEnd(13)}`
                + `${gift.name}`, 
                colors.cyan
            );
            this.history && this.history.addGift(gift);
            this.emitter.emit('any', gift);
        }
    }

    onPK(pk) {
        const valid = this.checkUnique(pk, 'pk');
        if (valid) {
            cprint(
                `${pk['id'].toString().padEnd(13)}`
                + `@${pk['roomid'].toString().padEnd(13)}`
                + `${pk['type'].padEnd(13)}`
                + `${pk['name']}`, 
                colors.cyan
            );
            this.history && this.history.addGift(pk);
            this.emitter.emit('any', pk);
        }
    }

    onStorm(storm) {
        cprint(
            `${storm['id'].toString().slice(0,7).padEnd(13)}`
            + `@${storm['roomid'].toString().padEnd(13)}`
            + `${storm['type'].padEnd(13)}`
            + `${storm['name'].padEnd(13)}`
            + `${storm['id']}`,
            colors.cyan
        );
        this.emitter.emit('any', storm);
    }

    checkUnique(someGift, type) {
        let valid = true;
        if (this.history) {
            const giftList = this.history.get(type);
            if (!giftList) return true;

            const validList = giftList.valid;
            const nearExpiredList = giftList.almostExpire;
            if (validList) {
                valid = !validList.some(g => (g.id === someGift.id));
                if (valid && nearExpiredList) 
                    valid = !nearExpiredList.some(g => (g.id === someGift.id));
            }
        }
        return valid;
    }

}

module.exports = RaffleHandler;
