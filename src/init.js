(function() {

    'use strict';

    const colors = require('colors/safe');
    const cprint = require('./util/printer.js');

    const config = require('./global/config.js');
    const settings = require('./settings.json');

    module.exports = init;

    function init() {
        raise_nofile_limit();
        read_args();
    }

    function raise_nofile_limit() {
        let limit = null;

        try {

            // 提升Linux系统nofile上限 (连接数量)
            // 系统层面调整上限(Linux): /etc/security/limits.conf
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

    function read_args() {
        if (process.argv.includes('-v')) {
            config.verbose = true;
        }
        if (process.argv.includes('--debug')) {
            config.debug = true;
        }

        config.ip = settings['wsServer']['self']['ip'];
        config.port = settings['wsServer']['self']['port'];

        const ipIndex = process.argv.indexOf('--ip');
        if (ipIndex !== -1) {
            const i = ipIndex;
            if (i + 1 < process.argv[i + 1]) {
                const ip = process.argv[i + 1];
                config.wsServer['self']['ip'] = ip;
            }
        }

        const portIndex = process.argv.indexOf('--port');
        if (portIndex !== -1) {
            const i = portIndex;
            if (i + 1 < process.argv[i + 1]) {
                const port = Number.parseInt(process.argv[i + 1]);
                if (!isNaN(port)) {
                    config.wsServer['self']['port'] = port;
                }
            }
        }

        const httpIpIndex = process.argv.indexOf('--hIp');
        if (httpIpIndex !== -1) {
            const i = httpIpIndex;
            if (i + 1 < process.argv[i + 1]) {
                const ip = process.argv[i + 1];
                config.httpServer['ip'] = ip;
            }
        }

        const httpPortIndex = process.argv.indexOf('--hPort');
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
