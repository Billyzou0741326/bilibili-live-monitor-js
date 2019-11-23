'use strict';

const colors = require('colors/safe');

const emitter = require('../global/config.js').raffleEmitter;
const cprint = require('../util/printer.js');

class RaffleHandler {

    constructor() {
        this.history = new Set();
        this.installed = false;
        this.emitter = emitter;
    }

    run() {
        this.listen();
    }

    listen() {
        if (this.installed === false && this.emitter) {
            this.installed = true;

            this.emitter.on('guard', (guard) => {
                cprint(
                    `${guard['id'].toString().padEnd(11)}`
                    + `@${guard['roomid'].toString().padEnd(11)}`
                    + `${guard['type'].padEnd(11)}`
                    + `${guard['name']}`, 
                    colors.cyan
                );
            });

            this.emitter.on('gift', (gift) => {
                cprint(
                    `${gift['id'].toString().padEnd(11)}`
                    + `@${gift['roomid'].toString().padEnd(11)}`
                    + `${gift['type'].padEnd(11)}`
                    + `${gift['name']}`, 
                    colors.cyan
                );
            });
        }
    }
}

module.exports = RaffleHandler;
