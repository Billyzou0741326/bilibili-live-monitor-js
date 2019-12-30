(function() {

    'use strict';

    const cluster = require('cluster');

    const cprint = require('./util/printer.js');
    const colors = require('colors/safe');

    // const Master = require('./process/master.js');
    const Master = require('./process/master.js');
    const {
        GiftWorker,
        FixedWorker,
        DynamicWorker, } = require('./process/worker.js');
    const {
        GIFT,
        FIXED,
        DYNAMIC_1,
        DYNAMIC_2, } = require('./global/config.js');

    const WSHost = require('./server/wshost.js');
    const WSHostBilive = require('./server/wshost-bilive.js');
    const HttpHost = require('./server/httphost.js');

    const init = require('./init.js');


    main();


    function main() {

        if (cluster.isMaster) {

            /** 总控
             *  - 通过各渠道（db、api）获取监听房间号
             *  - 向支线分配监听对象
             *  - 听取抽奖信息反馈
             */

            cprint('bilibili-monitor[1.0.0] successfully launched', colors.green);

            init();

            const master = new Master();
            master.run();

            const wsHost = new WSHost();
            wsHost.run();

            const wsHostBilive = new WSHostBilive();
            wsHostBilive.run();

            const httpHost = new HttpHost(master.history);
            httpHost.run();


            (master
                .on('gift', (g) => {
                    wsHost.broadcast(wsHost.parseMessage(g));
                    wsHostBilive.broadcast(wsHostBilive.parseMessage(g));
                })
                .on('guard', (g) => {
                    wsHost.broadcast(wsHost.parseMessage(g));
                    wsHostBilive.broadcast(wsHostBilive.parseMessage(g));
                })
                .on('pk', (g) => {
                    wsHost.broadcast(wsHost.parseMessage(g));
                    wsHostBilive.broadcast(wsHostBilive.parseMessage(g));
                })
                .on('storm', (g) => {
                    wsHost.broadcast(wsHost.parseMessage(g));
                    wsHostBilive.broadcast(wsHostBilive.parseMessage(g));
                }));

        } else if (cluster.isWorker) {

            /** 支线
             *  - 听取分配到的房间号、建立连接
             *  - 向主线反馈抽奖信息
             *  - 掉线处理
             */
            let worker = null;

            switch (process.env['type']) {
                case GIFT:
                    worker = new GiftWorker();
                    break;
                case FIXED:
                    worker = new FixedWorker();
                    break;
                case DYNAMIC_1:
                    // fall through
                case DYNAMIC_2:
                    worker = new DynamicWorker();
                    break;
                default:
                    process.exit(0);
            }

            worker && worker.run();

        }
    }

})();
