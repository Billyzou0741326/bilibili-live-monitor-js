/** There is an order in which the tasks
 *  execute. This is where happens-before
 *  relationships are established
 */
process.env.UV_THREAD_POOL_SIZE = 48;

const colors = require('colors');
const express = require('express');

const {
    RaffleMonitor, GuardMonitor } = require('./danmu/bilibilisocket.js');
const {
    RaffleController, GuardController } = require('./danmu/controller.js');
const RoomidHandler = require('./handler/roomidhandler.js');    // 弹幕监听播报高能房间号
const RaffleHandler = require('./handler/rafflehandler.js');    // 高能监听播报抽奖数据
const settings = require('./settings.json');
const config = require('./global/config.js');
const repository = config.repository;
const cprint = require('./util/printer.js');
const Server = require('./server/host.js');
const router = require('./server/router.js');

(function() {

    'use strict';

    (function main() {
        cprint('bilibili-monitor[1.0.0] successfully launched', colors.green);

        read_args();
        let limit = raise_nofile_limit();

        let raffleHandler = new RaffleHandler();
        let roomidHandler = new RoomidHandler();
        let guardController = new GuardController(limit);
        let raffleController = new RaffleController();
        let wsServer = new Server();
        let expressApp = new express();

        setupApp(expressApp);
        wsServer.run();

        repository.run();
        guardController.run();
        raffleController.run();
        raffleHandler.run();
        roomidHandler.run();
    })();


    function setupApp(expressApp) {
        const httpHost = settings['httpServer'].ip;
        const httpPort = settings['httpServer'].port;
        expressApp.use('/', router);
        expressApp.listen(httpPort, httpHost);
        cprint(`Http server listening on ${httpHost}:${httpPort}`, colors.green);
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

        config.ip = settings['server']['ip'];
        config.port = settings['server']['port'];

        const ipIndex = process.argv.indexOf('--ip');
        if (ipIndex !== -1) {
            if (ipIndex + 1 < process.argv[ipIndex+1]) {
                const ip = process.argv[ipIndex+1];
                config.server['ip'] = ip;
            }
        }

        const portIndex = process.argv.indexOf('--port');
        if (portIndex !== -1) {
            if (portIndex + 1 < process.argv[portIndex+1]) {
                const port = Number.parseInt(process.argv[portIndex+1]);
                if (!isNaN(port)) {
                    config.server['port'] = port;
                }
            }
        }
    }

})();


