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
            this.guardHandler = this.handler.bind(this, 'guard');
            this.giftHandler = this.handler.bind(this, 'gift');
            this.pkHandler = this.handler.bind(this, 'pk');
            this.setCors = this.setCors.bind(this);
        }

        run() {
            if (this.started === false) {
                this.router.use('/', this.setCors);
                this.router.get('/guard', this.guardHandler);
                this.router.get('/gift', this.giftHandler);
                this.router.get('/pk', this.pkHandler);
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

        handler(type, request, response) {
            const gifts = this.history.get(type);
            response.set({
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            });
            response.jsonp(gifts);
        }
    }

    module.exports = RT;

})();
