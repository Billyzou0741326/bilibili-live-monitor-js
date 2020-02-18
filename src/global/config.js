(function() {

    'use strict';

    const settings = require('../settings.json');
    const EventEmitter = require('events').EventEmitter;
    const HostResolver = require('../net/hostresolver.js');

    const bilibiliServer = {
        'host': 'broadcastlv.chat.bilibili.com',
        'trackIPs': settings.bilibiliIPTracker && settings.bilibiliIPTracker.hasOwnProperty('trackIPs') ? settings.bilibiliIPTracker.trackIPs : true,
        'dnsFailureRetries': settings.bilibiliIPTracker && settings.bilibiliIPTracker.hasOwnProperty('dnsFailureRetries') ? settings.bilibiliIPTracker.dnsFailureRetries : 3,
        'dnsFailureRetryDelay': (settings.bilibiliIPTracker && settings.bilibiliIPTracker.hasOwnProperty('dnsFailureRetryDelay') ? settings.bilibiliIPTracker.dnsFailureRetryDelay : 5) * 1000,
        'staticUpdateInterval': (settings.bilibiliIPTracker && settings.bilibiliIPTracker.hasOwnProperty('staticUpdateInterval') ? settings.bilibiliIPTracker.staticUpdateInterval : 60) * 1000,
        'dynamicUpdateThreashold': settings.bilibiliIPTracker && settings.bilibiliIPTracker.hasOwnProperty('dynamicUpdateThreashold') ? settings.bilibiliIPTracker.dynamicUpdateThreashold : 100,
        'unreliableHostThreashold': settings.bilibiliIPTracker && settings.bilibiliIPTracker.hasOwnProperty('unreliableHostThreashold') ? settings.bilibiliIPTracker.unreliableHostThreashold : 5,
        'unusableNetworkThreshold': settings.bilibiliIPTracker && settings.bilibiliIPTracker.hasOwnProperty('unusableNetworkThreshold') ? settings.bilibiliIPTracker.unusableNetworkThreshold : 0,
        'exitWhenNetworkUnusable': settings.bilibiliIPTracker && settings.bilibiliIPTracker.hasOwnProperty('exitWhenNetworkUnusable') ? settings.bilibiliIPTracker.exitWhenNetworkUnusable : false
    };

    const wsUri = {
        'host': new HostResolver(bilibiliServer.host, bilibiliServer),
        'port': 2243,
    };

    const lh = '127.0.0.1';
    const wsServer = {
        'self': {
            'host': settings['wsServer']['ip'] || '0.0.0.0',
            'port': settings['wsServer']['port'] || 8999,
        },
        'bilive': {
            'host': settings['wsServer']['ip'] || '0.0.0.0',
            'port': settings['wsServer']['port'] || 8998,
        },
    };
    const httpServer = {
        'host': settings['httpServer']['ip'] || '0.0.0.0',
        'port': settings['httpServer']['port'] || 9001,
    };

    let verbose = false;
    let debug = false;
    let debugHttp = false;

    const GIFT = 'GIFT';
    const FIXED = 'FIXED';
    const DYNAMIC_1 = 'DYNAMIC_1';
    const DYNAMIC_2 = 'DYNAMIC_2';

    process.env['x'] = 'X-Remote-IP';
    const statistics = {
        'appId': 1,
        'platform': 3,
        'version': '5.51.1',
        'abtest': '',
    };
    const appkey = '1d8b6e7d45233436';
    const appSecret = '560c52ccd288fed045859ed18bffd973';
    const appCommon = {
        'appkey': appkey,
        'build': 5511400,
        'channel': 'bili',
        'device': 'android',
        'mobi_app': 'android',
        'platform': 'android',
        'statistics': JSON.stringify(statistics),
    };
    const appHeaders = {
        'Connection': 'close',
        'User-Agent': 'Mozilla/5.0 BiliDroid/5.51.1 (bbcallen@gmail.com)',
    };
    appHeaders[process.env['x']] = lh;
    const webHeaders = {
        'Connection': 'close',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36',
    };
    webHeaders[process.env['x']] = lh;

    const error = {
        'count': 0,
    };

    read_args();

    function read_args() {
        if (process.argv.includes('-v')) {
            verbose = true;
        }
        if (process.argv.includes('--debug')) {
            debug = true;
        }
        if (process.argv.includes('--debug-http')) {
            debugHttp = true;
        }

        wsServer['self']['host'] = settings['wsServer']['self']['ip'];
        wsServer['self']['port'] = settings['wsServer']['self']['port'];
        wsServer['bilive']['host'] = settings['wsServer']['bilive']['ip'];
        wsServer['bilive']['port'] = settings['wsServer']['bilive']['port'];

        const ipIndex = process.argv.indexOf('--ws-ip');
        if (ipIndex !== -1) {
            const i = ipIndex;
            if (i + 1 < process.argv[i + 1]) {
                const ip = process.argv[i + 1];
                wsServer['self']['ip'] = ip;
            }
        }

        const portIndex = process.argv.indexOf('--ws-port');
        if (portIndex !== -1) {
            const i = portIndex;
            if (i + 1 < process.argv[i + 1]) {
                const port = Number.parseInt(process.argv[i + 1]);
                if (!isNaN(port)) {
                    wsServer['self']['port'] = port;
                }
            }
        }

        const httpIpIndex = process.argv.indexOf('--http-ip');
        if (httpIpIndex !== -1) {
            const i = httpIpIndex;
            if (i + 1 < process.argv[i + 1]) {
                const ip = process.argv[i + 1];
                httpServer['ip'] = ip;
            }
        }

        const httpPortIndex = process.argv.indexOf('--http-port');
        if (httpPortIndex !== -1) {
            const i = httpPortIndex;
            if (i + 1 < process.argv[i + 1]) {
                const port = Number.parseInt(process.argv[i + 1]);
                if (!isNaN(port)) {
                    httpServer['port'] = port;
                }
            }
        }
    }

    module.exports = {
        GIFT,
        FIXED,
        DYNAMIC_1,
        DYNAMIC_2,
        bilibiliServer,
        wsUri,
        wsServer,
        httpServer,
        appCommon,
        appHeaders,
        appSecret,
        webHeaders,
        verbose,
        debug,
        debugHttp,
        error,
    };

})();
