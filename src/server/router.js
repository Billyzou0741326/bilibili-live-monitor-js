(function() {

    'use strict';

    const express = require('express');

    const History = require('../handler/history.js');

    class RT {

        constructor(history) {
            const router = express.Router({ 'mergeParams': true });
            this.router = router;
            this.history = history || new History();
            this.started = false;

            this.bind();
        }

        bind() {
            this.guardHandler = this.guardHandler.bind(this);
        }

        run() {
            if (this.started === false) {
                this.router.get('/guard', this.guardHandler);
                this.started = true;
            }
        }

        getRouter() {
            return this.router;
        }

        guardHandler(request, response) {
            const guards = this.history.repo['guard'];
            response.jsonp(guards);
        }
    }

    module.exports = RT;

})();
