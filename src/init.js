(function() {

    'use strict';

    const colors = require('colors/safe');
    const cprint = require('./util/printer.js');

    const config = require('./global/config.js');
    const settings = require('./settings.json');

    module.exports = init;

    /**
     * Raises nofile limit on Linux system, and align config to arguments
     */
    function init() {
        raise_nofile_limit();
        read_args();
    }

    /**
     * Raises Linux nofile limit
     */
    function raise_nofile_limit() {
        let limit = null;

        try {

            // Raises Linux nofile limit
            // System level configuration: /etc/security/limits.conf
            if (process.platform === 'linux') {
                const posix = require('posix');
                const hard_limit = posix.getrlimit('nofile')['hard'];
                limit = hard_limit;
                posix.setrlimit('nofile', { 'soft': hard_limit });
                cprint(`Unix nofile 上限调整至极限: ${hard_limit}`, colors.green);
            }

        } catch (error) {}

        return limit;
    };


    /**
     * Reads in arguments, overwrite configurations
     */
    function read_args() {
        if (process.argv.includes('-v')) {
            config.verbose = true;
        }
        if (process.argv.includes('--debug')) {
            config.debug = true;
        }
        if (process.argv.includes('--debug-http')) {
            config.debugHttp = true;
        }

        config.wsServer['self']['host'] = settings['wsServer']['self']['ip'];
        config.wsServer['self']['port'] = settings['wsServer']['self']['port'];
        config.wsServer['bilive']['host'] = settings['wsServer']['bilive']['ip'];
        config.wsServer['bilive']['port'] = settings['wsServer']['bilive']['port'];

        const ipIndex = process.argv.indexOf('--ws-ip');
        if (ipIndex !== -1) {
            const i = ipIndex;
            if (i + 1 < process.argv[i + 1]) {
                const ip = process.argv[i + 1];
                config.wsServer['self']['ip'] = ip;
            }
        }

        const portIndex = process.argv.indexOf('--ws-port');
        if (portIndex !== -1) {
            const i = portIndex;
            if (i + 1 < process.argv[i + 1]) {
                const port = Number.parseInt(process.argv[i + 1]);
                if (!isNaN(port)) {
                    config.wsServer['self']['port'] = port;
                }
            }
        }

        const httpIpIndex = process.argv.indexOf('--http-ip');
        if (httpIpIndex !== -1) {
            const i = httpIpIndex;
            if (i + 1 < process.argv[i + 1]) {
                const ip = process.argv[i + 1];
                config.httpServer['ip'] = ip;
            }
        }

        const httpPortIndex = process.argv.indexOf('--http-port');
        if (httpPortIndex !== -1) {
            const i = httpPortIndex;
            if (i + 1 < process.argv[i + 1]) {
                const port = Number.parseInt(process.argv[i + 1]);
                if (!isNaN(port)) {
                    config.httpServer['port'] = port;
                }
            }
        }
    }


})();
