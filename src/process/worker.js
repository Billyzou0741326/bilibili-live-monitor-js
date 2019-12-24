(function() {

    'use strict';

    const cluster = require('cluster');

    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    const AbstractWorker = require('./abstractworker.js');

    const {
        RaffleController,
        DynamicController,
        FixedController, } = require('../danmu/controller.js');


    class GiftWorker extends AbstractWorker {

        constructor() {
            super();
            this.from = 'gift';
            this.running = false;

            this.controller = new RaffleController();
        }

        run() {
            if (this.running === false) {
                this.running = true;
                this.controller.run();
                (this.controller
                    .on('gift', this.onGift('gift'))
                    .on('guard', this.onGift('guard'))
                    .on('pk', this.onGift('pk'))
                    .on('storm', this.onGift('storm')));
            }
        }

        onMessage(msg) {
            super.onMessage(msg);
            switch (msg['cmd']) {
                case 'update_rooms':
                    break;
            }
        }

    }

    class FixedWorker extends AbstractWorker {

        constructor() {
            super();
            this.from = 'fixed';
            this.running = false;

            this.controller = new FixedController();
        }

        run() {
            if (this.running === false) {
                this.running = true;
                this.controller.run();
                (this.controller
                    .on('gift', this.onGift('gift'))
                    .on('guard', this.onGift('guard'))
                    .on('pk', this.onGift('pk'))
                    .on('storm', this.onGift('storm'))
                    .on('add_to_db', (rid) => this.addToDB(rid)));
                process.send({
                    'cmd': 'get_fixed_rooms',
                    'from': this.from,
                });
            }
        }

        addToDB(roomid) {
            const msg = {
                'cmd': 'add_to_db',
                'from': this.from,
                'to': 'master',
                'data': roomid,
            };
            process.send(msg);
        }

        onMessage(msg) {
            super.onMessage(msg);
            switch (msg['cmd']) {
                case 'update_rooms':
                    const rooms = msg['data'];
                    this.controller.updateRooms(rooms);
                    cprint(`Received ${rooms.length} fixed rooms`, colors.green);
                    break;
            }
        }

    }

    class DynamicWorker extends AbstractWorker {

        constructor() {
            super();
            this.from = 'dynamic';
            this.running = false;

            this.controller = new DynamicController();
            this.scheduledUpdate = null;
        }

        bind() {
            super.bind();
            this.updateTask = this.updateTask.bind(this);
            this.addToFixed = this.addToFixed.bind(this);
        }

        updateTask() {
            process.send({
                'cmd': 'get_dynamic_rooms',
                'from': this.from,
            });
        }

        addToFixed(roomid) {
            process.send({
                'cmd': 'add_fixed',
                'from': this.from,
                'data': roomid,
            });
        }

        run() {
            if (this.running === false) {
                this.running = true;
                this.controller.run();
                this.updateTask();
                (this.controller
                    .on('gift', this.onGift('gift'))
                    .on('guard', this.onGift('guard'))
                    .on('pk', this.onGift('pk'))
                    .on('storm', this.onGift('storm'))
                    .on('add_fixed', this.addToFixed)
                    .on('get_new_rooms', this.updateTask));
            }
        }

        onMessage(msg) {
            super.onMessage(msg);
            switch (msg['cmd']) {
                case 'update_rooms':
                    const rooms = msg['data'];
                    this.controller.updateRooms(rooms);
                    cprint(`Received ${rooms.length} dynamic rooms`, colors.green);
                    break;
            }
        }

    }

    module.exports = {
        GiftWorker,
        FixedWorker,
        DynamicWorker,
    }

})();

