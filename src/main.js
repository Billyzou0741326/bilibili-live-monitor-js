/** There is an order in which the tasks
 *  execute. This is where happens-before
 *  relationships are established
 */
process.env.UV_THREAD_POOL_SIZE = 48;
process.env['x'] = 'X-Remote-IP';

const colors = require('colors/safe');
const express = require('express');
const http = require('http');

const {
    RaffleMonitor, GuardMonitor } = require('./danmu/bilibilisocket.js');
const {
    RaffleController, GuardController } = require('./danmu/controller.js');
const RoomidHandler = require('./handler/roomidhandler.js');    // 弹幕监听播报高能房间号
const RaffleHandler = require('./handler/rafflehandler.js');    // 高能监听播报抽奖数据
const History = require('./handler/history.js');
const Database = require('./db/database.js');
const settings = require('./settings.json');
const config = require('./global/config.js');
const cprint = require('./util/printer.js');
const Server = require('./server/host.js');
const router = require('./server/router.js');

(function() {

    'use strict';

    (function main() {
        cprint('bilibili-monitor[1.0.0] successfully launched', colors.green);

        read_args();
        const limit = raise_nofile_limit();

        const db = new Database('record');
        const history = new History(config.raffleEmitter);
        const raffleHandler = new RaffleHandler({ history, db });
        const roomidHandler = new RoomidHandler();
        const guardController = new GuardController({ limit, db });
        const raffleController = new RaffleController();
        router.startRouter(history);
        const wsServer = new Server();
        const expressApp = new express();

        setupApp(expressApp);
        wsServer.run();

        history.run();
        guardController.run();
        raffleController.run();
        raffleHandler.run();
        roomidHandler.run();

    })();


    function setupApp(expressApp) {
        const httpHost = config['httpServer'].host;
        const httpPort = config['httpServer'].port;
        expressApp.use('/', router.getRouter());
        const server = http.createServer(expressApp).listen(httpPort, httpHost);
        server.on('error', error => {
            if (error.code === 'EADDRINUSE') {
                cprint(`未能建立http服务器 - 端口${httpPort}已被占用`, colors.red);
                cprint('建议修改``settings.json``中的httpServer.port值', colors.red);
            } else {
                cprint(`Error: error.message`, colors.red);
            }
        });
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

        config.ip = settings['wsServer']['ip'];
        config.port = settings['wsServer']['port'];

        const ipIndex = process.argv.indexOf('--ip');
        if (ipIndex !== -1) {
            const i = ipIndex;
            if (i + 1 < process.argv[i + 1]) {
                const ip = process.argv[i + 1];
                config.wsServer['ip'] = ip;
            }
        }

        const portIndex = process.argv.indexOf('--port');
        if (portIndex !== -1) {
            const i = portIndex;
            if (i + 1 < process.argv[i + 1]) {
                const port = Number.parseInt(process.argv[i + 1]);
                if (!isNaN(port)) {
                    config.wsServer['port'] = port;
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


