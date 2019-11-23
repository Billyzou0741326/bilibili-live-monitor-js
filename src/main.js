'use strict';

/** There is an order in which the tasks
 *  execute. This is where happens-before
 *  relationships are established
 */
const colors = require('colors');

const {
    RaffleMonitor, GuardMonitor } = require('./danmu/bilibilisocket.js');
const {
    RaffleController, GuardController } = require('./danmu/controller.js');
const RoomidHandler = require('./handler/roomidhandler.js');    // 弹幕监听播报高能房间号
const RaffleHandler = require('./handler/rafflehandler.js');    // 高能监听播报抽奖数据
const cprint = require('./util/printer.js');

const raise_nofile_limit = () => {
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


(function main() {
    let limit = raise_nofile_limit();

    let raffleHandler = new RaffleHandler();
    let roomidHandler = new RoomidHandler();
    let guardController = new GuardController(limit);

    guardController.run();
    raffleHandler.run();
    roomidHandler.run();
})();
