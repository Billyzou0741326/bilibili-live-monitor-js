(function() {

    'use strict';

    const http = require('http');
    const express = require('express');

    const config = require('../global/config.js');

    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    const Router = require('./router.js');

    class HttpHost {

        constructor(history, options) {
            this.bind();
            if (options && options.host)
                this.host = options.host;
            else
                this.host = config['httpServer']['host'];

            if (options && options.port)
                this.port = options.port;
            else
                this.port = config['httpServer']['port'];

            this.router = new Router(history);
            this.app = new express();
            this.server = null;
        }

        bind() {
            this.pageNotFound = this.pageNotFound.bind(this);
        }

        pageNotFound(error, request, response, next) {
            if (error) {
                response.send('<h1> Errored </h1>');
                return null;
            }
            response.send('<h1> Page Not Found </h1>');
        }

        run() {
            this.router.run();
            this.app.set('json spaces', 4);
            this.app.use('/', this.router.getRouter());
            this.app.use('/', this.pageNotFound);
            this.server = http.createServer(this.app).listen(this.port, this.host);
            this.server.on('error', error => {
                if (error.code === 'EADDRINUSE') {
                    cprint(`未能建立http服务 - 端口${this.port}已被占用`, colors.red);
                    cprint('建议修改``settings.json``中的httpServer.port值', colors.red);
                } else {
                    cprint(`Error: error.message`, colors.red);
                }
            });
            cprint(`Http server listening on ${this.host}:${this.port}`, colors.green);
        }
    }

    module.exports = HttpHost;

})();
