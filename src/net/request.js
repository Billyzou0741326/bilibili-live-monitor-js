(function() {

    'use strict';


    const querystring = require('querystring');


    class Request {

        constructor(options) {
            const {
                host,
                path,
                port,
                https,
                method,
                params,
                data,
                headers,
                contentType, } = options;
            Object.assign(this, options);
            Object.freeze(this);
        }

    }

    class RequestBuilder {

        static formatParams(params) {
            const formattedParams = querystring.stringify(params, '&', '=');
            return formattedParams;
        }

        static start() {
            return new RequestBuilder();
        }
        
        withHost(host) {
            this.host = host;
            return this;
        }

        withPath(path) {
            this.path = path;
            return this;
        }

        withPort(port) {
            this.port = +port;
            return this;
        }

        withMethod(method) {
            this.method = method;
            return this;
        }

        withHttps() {
            this.https = true;
            return this;
        }

        withData(data) {
            if (typeof data !== 'string' && data instanceof String === false) {
                data = RequestBuilder.formatParams(sort(data));
            }
            this.data = data;
            return this;
        }

        withParams(params) {
            if (typeof params !== 'string' && params instanceof String === false) {
                params = RequestBuilder.formatParams(sort(params));
            }
            this.params = params;
            return this;
        }

        withHeaders(headers) {
            this.headers = headers;
            return this;
        }

        withContentType(contentType) {
            this.contentType = contentType;
            return this;
        }

        build() {
            this.host = this.host || 'localhost';
            this.https = this.https === true;
            this.params = this.params || '';
            this.path = this.path || '';
            this.path = (this.params !== '' ? `${this.path}?${this.params}` : this.path);
            this.method = this.method || 'GET';
            this.data = this.data || '';
            this.headers = this.headers || { 'Connection': 'close' };
            this.contentType = this.contentType || 'application/x-www-form-urlencoded';
            return new Request(this);
        }
    }

    const sort = (object) => {
        const sorted = {};
        Object.keys(object).sort().forEach(key => {
            sorted[key] = object[key];
        });
        return sorted;
    };

    module.exports = RequestBuilder;

})();
