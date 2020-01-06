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
            // 记录掉线IP。
            if (current && current != this.hostname) {
                // console.log('掉线'+current);
                this.loss[this.hosts.indexOf(current)]++;
            }            
            // 根据goodip列表轮换IP
            for (let [i,v] of this.lastip.entries()) {
                if (this.goodip.indexOf(v) != -1){
                    this.lastip.push(v);
                    this.lastip.splice(i,1);
                    break;
                }
            }
            return this.lastip[this.lastip.length-1];
        },
        'port': 2243,
        'hostname': 'broadcastlv.chat.bilibili.com',
        'hosts': [], //DNS返回IP列表
        'loss': [], //实时掉线统计,对应hosts列表
        'lastloss': [], //前一时间段掉线统计,对应hosts列表
        'lastip': [], //IP连接顺序
        'goodip': [], //网络较好IP
    };

    //初始化IP数据
    dns.resolve(wsUri.hostname, function(err, address, family){
        wsUri.hosts = address;
        wsUri.lastip = wsUri.hosts;
        wsUri.goodip = wsUri.hosts;
        for (let [i,v] of wsUri.hosts.entries()) {
            wsUri.loss[i] = 0;
            wsUri.lastloss[i] = 0;
        }
        // 更新重置掉线统计
        function update(){
            wsUri.lastloss = wsUri.loss;
            wsUri.loss = wsUri.loss.map(v =>0);
            //更新网络较好IP列表
            let minloss = Math.min(...wsUri.lastloss);
            let goodip = [];
            for (let [i,v] of wsUri.lastloss.entries()){
                if (v-minloss < 1) {
                    goodip.push(wsUri.hosts[i]);
                }
            }
            wsUri.goodip = goodip;
        }
        setInterval(update,30 * 1000)
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
