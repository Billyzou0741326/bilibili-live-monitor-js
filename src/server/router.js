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
        }

        run() {
            if (this.started === false) {
                this.router.get('/guard', this.guardHandler);
                this.router.get('/gift', this.giftHandler);
                this.started = true;
            }
        }

        getRouter() {
            return this.router;
        }

        giftHandler(request, response) {
            const gifts = this.history.repo['gift'];
            response.jsonp(gifts);
        }

        guardHandler(request, response) {
            const guards = this.history.repo['guard'];
            response.jsonp(guards);
        }
    }

    module.exports = RT;

})();
