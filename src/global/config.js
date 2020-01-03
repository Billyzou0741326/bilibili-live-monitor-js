(function() {

    'use strict';

    const settings = require('../settings.json');
    const EventEmitter = require('events').EventEmitter;
    const dns = require('dns');

    const wsUri = {
        'host': function(current){
            if(this.hosts.length==0){
                return this.hostname;
            }
            // 重连
            if (current) {
                this.loss[this.hosts.indexOf(current)]++;
                let tempi = 0;
                let tempv = this.loss[this.hosts.indexOf(current)];
                for (let i in this.loss){
                    if (this.loss[i]<tempv) {
                        tempi = i;
                        tempv = this.loss[i];
                    }
                }
                if (this.loss[this.hosts.indexOf(current)] > 100){
                    for (let i in this.loss){
                        this.loss[i] = Math.round(this.loss[i]/10);
                    }
                }
                return this.hosts[tempi];
            }
            // 初始连接
            if(this.mark<this.hosts.length){
                this.mark++
            } else {
                this.mark = 1;
            }
            return this.hosts[this.mark-1];
        },
        'port': 2243,
        'hostname': 'broadcastlv.chat.bilibili.com',
        'hosts': [],
        'mark': 0,
        'loss': [0,0,0,0],
    };

    dns.resolve(wsUri.hostname, function(err, address, family){
        wsUri.hosts = address;
    })

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

    const verbose = false;
    const debug = false;

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

    module.exports = {
        GIFT,
        FIXED,
        DYNAMIC_1,
        DYNAMIC_2,
        wsUri,
        wsServer,
        httpServer,
        appCommon,
        appHeaders,
        appSecret,
        webHeaders,
        verbose,
        debug,
        error,
    };

})();
