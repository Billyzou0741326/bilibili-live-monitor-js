(function() {

    'use strict';

    const express = require('express');
    const router = express.Router({ 'mergeParams': true });

    const api = require('./api.js');

    class RT {

        constructor() {
            this.started = false;
            this.router = router;
        }

        startRouter(history) {
            const guardHandler = (request, response) => {
                api.guardHandler(history, request, response);
            };
            if (this.started === false) {
                this.router.get('/guard', guardHandler);
                this.started = true;
            }
        }

        getRouter() {
            return this.router;
        }
    }

    const rt = new RT();

    module.exports = rt;

})();
