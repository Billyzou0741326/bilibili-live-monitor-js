(function() {

    'use strict';

    const express = require('express');

    const History = require('../handler/history.js');

    class RT {

        constructor(history) {
            this.bind();

            const router = express.Router({ 'mergeParams': true });
            this.router = router;
            this.history = history || new History();
            this.started = false;
        }

        bind() {
            this.guardHandler = this.guardHandler.bind(this);
            this.giftHandler = this.giftHandler.bind(this);
            this.setCors = this.setCors.bind(this);
        }

        run() {
            if (this.started === false) {
                this.router.use('/', this.setCors);
                this.router.get('/guard', this.guardHandler);
                this.router.get('/gift', this.giftHandler);
                this.started = true;
            }
        }

        getRouter() {
            return this.router;
        }

        setCors(request, response, next) {
            response.append('Access-Control-Allow-Origin', ['*']);
            response.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
            response.append('Access-Control-Allow-Headers', 'Content-Type');
            next();
        }

        giftHandler(request, response) {
            const gifts = this.history.get('gift');
            response.set({
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            });
            response.jsonp(gifts);
        }

        guardHandler(request, response) {
            const guards = this.history.get('guard');
            response.set({
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            });
            response.jsonp(guards);
        }
    }

    module.exports = RT;

})();
