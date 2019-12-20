(function() {

    'use strict';

    const https = require('https');
    const WebSocket = require('ws');
    const Host = require('./host.js');

    class HttpsHost extends Host {

        constructor(host, port, ssl) {
            super(host, port);
            const { key, cert } = ssl;
            this.key = key;
            this.cert = cert;
        }

        createServer() {
            const server = https.createServer({
                'key': this.key,
                'cert': this.cert,
            });
            return server;
        }

        listen(server) {
            const wss = new WebSocket.Server({ server });
            super.listen(wss);
        }
    }

    module.exports = HttpsHost;

})();
