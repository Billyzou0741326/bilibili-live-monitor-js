(function() {

    'use strict';

    const settings = require('../settings.json');
    const EventEmitter = require('events').EventEmitter;
    const dns = require('dns');

    const wsUri = {
        'host': function(current){
            // 未获取IP
            if(this.hosts.length==0){
                return this.hostname;
            }
            // 最近重连统计，到100次按比例重置
            if (current) {
                this.loss[this.hosts.indexOf(current)]++;
                if (this.loss[this.hosts.indexOf(current)] > 100){
                    for (let [i,v] of this.loss.entries()){
                        this.loss[i] = Math.ceil(v/10);
                    }
                }
            }
            // 筛选掉线率低IP
            let lasti = this.hosts.indexOf(this.lastip[this.lastip.length-1]);
            let tempv = this.loss[lasti];
            let goodip = [];
            for (let [i,v] of this.loss.entries()){
                if (i != lasti && v/tempv <1.1) {
                    goodip.push(this.hosts[i]);
                    tempv = v;
                } 
            }
            // 根据最后IP连接记录轮换掉线率低IP
            for (let [i,v] of this.lastip.entries()) {
                if (goodip.indexOf(v) != -1){
                    this.lastip.push(v);
                    this.lastip.splice(i,1);
                    break;
                }
            }
            return this.lastip[this.lastip.length-1];
        },
        'port': 2243,
        'hostname': 'broadcastlv.chat.bilibili.com',
        'hosts': [],
        'loss': [],
        'lastip':[],
    };

    dns.resolve(wsUri.hostname, function(err, address, family){
        wsUri.hosts = address;
        wsUri.lastip = wsUri.hosts;
        for (let [i,v] of wsUri.hosts.entries()) {
            wsUri.loss[i] = 1;
        }
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
