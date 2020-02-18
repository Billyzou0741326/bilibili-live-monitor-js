(function() {

    'use strict';

    const dns = require('dns');
    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    class ResolvedHost {

        /**
         * @constructor
         * @param   {string}       address
         * @param   {HostResolver} resolver
         */
        constructor(address, resolver) {
            this._address = address;
            this._resolver = resolver;
        }

        get address() {
            return this._address;
        }

        reportDisconnection() {
            // Report and get a new address from resolver.
            this._resolver.reportDisconnection(this._address);
            this._address = this._resolver.resolve().address;
        }
    }

    class HostResolver {

        /**
         * @constructor
         * @param   {string}   host
         * @param   {any}      options
         */
        constructor(host, options) {
            this._host = host;

            if (options) {
                this._options = options;
            } else {
                this._options = {
                    'trackIPs': true, // 使用IP掉线检测和智能动态分配
                    'dnsFailureRetries': 3, // DNS解析错误时重试次数
                    'dnsFailureRetryDelay': 1000 * 5, // DNS解析错误时重试延时，默认5秒
                    'staticUpdateInterval': 1000 * 60, // 静态更新掉线统计间隔时长，默认60秒
                    'dynamicUpdateThreashold': 100, // 动态更新掉线统计阈值
                    'unreliableHostThreashold': 5, // 可用IP掉线偏差阈值。数字越大得到的好IP越多，连接数越平均
                    'unusableNetworkThreshold': 0, // 网络可用判定最小掉线数阈值，默认值为0，不进行检测
                    'exitWhenNetworkUnusable': false // 网络不可用时是否退出
                }
            }

            if (this._options.trackIPs) {
                this._initialized = false;
                this._hostIPs = new Map(); // DNS返回IP列表
                this._count = 0; // 掉线次数统计
            }
        }

        // 初始化IP数据
        resolveDns() {
            dns.resolve(this._host, (err, records) => {
                if (!err) {
                    for (const ip of records) {
                        this._hostIPs.set(ip, 0);
                    }
                    this._goodIPs = records.slice(); // 网络较好IP
                    this._lastIPIndex = -1; // IP连接顺序

                    // 固定时间更新掉线统计
                    this._updateTask = setInterval(() => this.update(), this._options.staticUpdateInterval);
                } else {
                    cprint(`HostResolver - DNS resolve failure: ${err.message}`, colors.red);
                    if (this._dnsFailureRetries-- > 0) {
                        setTimeout(() => this.resolveDns(), this._options.dnsFailureRetryDelay);
                    }
                }
            });
        }

        reportDisconnection(address) {
            // 记录掉线IP
            if (this._options.trackIPs && this._hostIPs.has(address)) {
                //cprint(`HostResolver - Disconncetion reported: ${address}`, colors.yellow);
                this._hostIPs.set(address, this._hostIPs.get(address) + 1);

                // 记录请求次数，动态更新掉线统计
                if (++this._count >= this._options.dynamicUpdateThreashold) {
                    this.update();
                }
            }
        }

        resolve() {
            // 禁用追踪
            if (!this._options.trackIPs) {
                return new ResolvedHost(this._host, this);
            }

            // 尚未获取IP
            if (this._hostIPs.size === 0) {
                if (!this._initialized) {
                    this._dnsFailureRetries = this._options.dnsFailureRetries;
                    this.resolveDns();
                    this._initialized = true;
                }
                return new ResolvedHost(this._host, this);
            }

            // 根据goodIPs列表轮换IP
            if (++this._lastIPIndex >= this._goodIPs.length) {
                this._lastIPIndex = 0;
            }
            return new ResolvedHost(this._goodIPs[this._lastIPIndex], this);
        }

         // 更新掉线统计
        update() {
            this._count = 0;

            // 更新网络较好IP列表
            const minCount = Math.min(...this._hostIPs.values());
            if (this._unusableNetworkThreshold > 0 && minCount > this._options.unusableNetworkThreshold) {
                // 掉线率过高
                cprint(`HostResolver - high rate of disconnections: ${minCount}`, colors.red);
                if (this._options.exitWhenNetworkUnusable) {
                    process.exit(1);
                } else {
                    // 重新平均分配IP
                    this._goodIPs = [...this._hostIPs.keys()];
                }
            } else {
                this._goodIPs = [];
                for (const [ip, count] of this._hostIPs) {
                    //cprint(`HostResolver - ${ip} disconnection count: ${count}`, colors.yellow);
                    if (count - minCount <= this._options.unreliableHostThreashold) {
                        this._goodIPs.push(ip);
                    }
                    this._hostIPs.set(ip, 0);
                }
            }
        }
    };

    module.exports = HostResolver;

})();
