(function() {

    'use strict';

    const cluster = require('cluster');
    
    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');
    const config = require('../global/config.js');

    class AbstractWorker {

        constructor() {
            this.bind();

            this.worker = cluster.worker;
            this.worker.on('message', this.onMessage);
            this.worker.on('disconnect', this.onDisconnect);
            this.worker.on('error', this.onError);

            if (config.verbose === false) {
                config.verbose = (process.env['verbose'] === 'true');
            }
        }

        bind() {
            this.onGift = this.onGift.bind(this);
            this.onError = this.onError.bind(this);
            this.onMessage = this.onMessage.bind(this);
            this.onDisconnect = this.onDisconnect.bind(this);
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

        onDisconnect() {
            process.exit(1);
        }

        onError(error) {
            cprint(`${error.message}`, colors.red);
            process.exit(1);
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
