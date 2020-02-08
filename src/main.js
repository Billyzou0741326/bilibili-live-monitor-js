(function() {

    'use strict';

    const cluster = require('cluster');

    const cprint = require('./util/printer.js');
    const colors = require('colors/safe');

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

            /** Master process
             *  - Spawns child processes
             *  - Pushes rooms to child processes
             *  - Listens for reported lottery information
             */

            cprint('bilibili-monitor[1.0.0] successfully launched', colors.green);

            // Raises Linux nofile limit, configures settings
            init();

            // Establish master object to spawn and manage workers
            const master = new Master();
            master.run();

            const wsHost = new WSHost();
            wsHost.run();

            const wsHostBilive = new WSHostBilive();
            wsHostBilive.run();

            const httpHost = new HttpHost(master.history);
            httpHost.run();

            if (process.platform === "win32") {
                require("readline").createInterface({
                    input: process.stdin,
                    output: process.stdout
                }).on("SIGINT", () => {
                    process.emit("SIGINT");
                });
            }

            process.on("SIGINT", () => {
                cprint('SIGINT received, shutting down...', colors.yellow);
                master.stop().then(
                    () => {
                        cprint('Graceful shutdown sequence executed, now exits.', colors.yellow);
                        process.exit();
                    }
                );
            });

            // On any of the following event, push to clients
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

            /** Worker process
             *  - Listens for distributed rooms, establish connections
             *  - Report lottery information to master process
             *  - Handle disconnections
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
