'use strict';

const colors = require('colors/safe');

const emitter = require('../global/config.js').raffleEmitter;
const cprint = require('../util/printer.js');

class RaffleHandler {

    constructor() {
        this.installed = false;
        this.emitter = emitter;
    }

    run() {
        this.listen();
    }

    listen() {
        if (this.installed === false && this.emitter) {
            this.installed = true;

            this.emitter
                .on('guard', (guard) => {
                    cprint(
                        `${guard['id'].toString().padEnd(13)}`
                        + `@${guard['roomid'].toString().padEnd(13)}`
                        + `${guard['type'].padEnd(13)}`
                        + `${guard['name']}`, 
                        colors.cyan
                    );
                })
                .on('gift', (gift) => {
                    cprint(
                        `${gift['id'].toString().padEnd(13)}`
                        + `@${gift['roomid'].toString().padEnd(13)}`
                        + `${gift['type'].padEnd(13)}`
                        + `${gift['name']}`, 
                        colors.cyan
                    );
                })
                .on('storm', (storm) => {
                    cprint(
                        `${storm['id'].toString().slice(0,7).padEnd(13)}`
                        + `@${storm['roomid'].toString().padEnd(13)}`
                        + `${storm['type'].padEnd(13)}`
                        + `${storm['name'].padEnd(13)}`
                        + `${storm['id']}`,
                        colors.cyan
                    );
                });
        }
    }
}

module.exports = RaffleHandler;
