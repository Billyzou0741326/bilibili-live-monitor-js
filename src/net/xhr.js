(function() {

    'use strict';

    const http = require('http');
    const https = require('https');
    const querystring = require('querystring');
    const ResponseBuilder = require('./response.js');
    const HttpError = require('./httperror.js');

    class Xhr {

        static newSession() {
            return new Xhr();
        }

        constructor() {
            this.blocked = false;
            this.unblockedAt = 0;
            this.statusCallback = {
                "200": () => {
                },
                "412": () => {
                    this.blocked = true;
                    this.unBlockedAt = 1000 * 60 * 61 + new Date();
                },
            };
        }

        isBlocked() {
            let result = false;
            if (this.blocked === true) {
                if (new Date() < this.unblockedAt) {
                    this.result = true;
                } else {
                    this.blocked = false;
                }
            }
            return result;
        }

        request(req) {
            if (req.method === 'GET') {
                return this.get(req);
            } else if (req.method === 'POST') {
                return this.post(req);
            }
            return Promise.reject(
                new HttpError(`Request method '${req.method}' not Implemented`));
        }

        get(req) {
            let xhr = http;
            let agent = httpAgent;
            if (req.https === true) {
                xhr = https;
                agent = httpsAgent;
            }

            const options = req.toHttpOptions();
            options['agent'] = agent;

            return new Promise((resolve, reject) => {

                if (this.isBlocked() === true) {
                    const err = new HttpError('412 Precondition Failing (estimation)');
                    reject(err);
                    return null;
                }

                const request = (this.sendRequest(options, xhr, req.data)
                    .on('response', response => {
                        const code = response.statusCode;

                        const dataSequence = [];
                        response.on('data', data => dataSequence.push(data));
                        response.on('error', error => reject(error));

                        if (code === 200) {
                            response.on('end', () => resolve(
                                this.makeResponse(
                                    response, request, Buffer.concat(dataSequence))));
                        } else {
                            resolve(
                                this.makeResponse(response, request));
                        }

                        this.statusCallback[code] && this.statusCallback[code]();
                    })
                );
            });
        }

        post(req) {
            let xhr = http;
            let agent = httpAgent;
            if (req.https === true) {
                xhr = https;
                agent = httpsAgent;
            }

            const options = req.toHttpOptions();
            options['agent'] = agent;

            return new Promise((resolve, reject) => {

                if (this.isBlocked() === true) {
                    const err = new HttpError('412 Precondition Failing (estimation)');
                    reject(err);
                    return null;
                }

                const request = (this.sendRequest(options, xhr, req.data)
                    .on('response', response => {
                        const code = response.statusCode;

                        const dataSequence = [];
                        response.on('data', data => dataSequence.push(data));
                        response.on('error', error => reject(error));

                        if (code === 200) {
                            response.on('end', () => resolve(
                                this.makeResponse(
                                    response, request, Buffer.concat(dataSequence))));
                        } else {
                            resolve(
                                this.makeResponse(response, request));
                        }

                        this.statusCallback[code] && this.statusCallback[code]();
                    }));
            });
        }

        sendRequest(options, xhr, data) {
            if (!xhr) xhr = https;
            let request = (xhr.request(options)
                .on('timeout', () => {
                    request.abort();
                })
                .on('abort', () => {
                    const err = new HttpError('Http request aborted');
                    reject(err);
                })
            );
            if (data) {
                request.write(data);
            }
            request.end();
            return request;
        }

        makeResponse(incomingMessage, request, data) {
            let url = '';
            let method = '';
            if (request) {
                url = `${request.host}${request.path}`;
                method = request.method;
            }
            return (ResponseBuilder.start()
                .withHttpResponse(incomingMessage)
                .withUrl(url)
                .withMethod(method)
                .withData(data)
                .build());
        };
    }


    module.exports = Xhr;


    /** https agent to handle request sending */
    const httpsAgent = (() => {
        const options = {
            'keepAlive': true,
            'maxFreeSockets': 20,
        };
        return new https.Agent(options);
    })();

    /** http agent to handle request sending */
    const httpAgent = (() => {
        const options = {
            'keepAlive': true,
            'maxFreeSockets': 20,
        };
        return new http.Agent(options);
    })();



})();
