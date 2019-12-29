(function() {

    'use strict';

    const cluster = require('cluster');
    
    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    class AbstractWorker {

        constructor() {
            this.bind();

            this.worker = cluster.worker;
            this.worker.on('message', this.onMessage);
        }

        bind() {
            this.onMessage = this.onMessage.bind(this);
            this.onGift = this.onGift.bind(this);
        }

        onGift(type) {
            return (gift) => {
                const msg = {};
                msg['cmd'] = type;
                msg['from'] = process.env['type'];
                msg['to'] = 'master';
                msg['data'] = gift;
                process.send(msg);
            };
        }

        onMessage(msg) {
            switch (msg['cmd']) {
                case 'close':
                    cprint(`Process ${process.pid} exiting`, colors.green);
                    process.exit(0);
                    break;
            }
        }
    }

    module.exports = AbstractWorker;

})();
