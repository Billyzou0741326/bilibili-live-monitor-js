'use strict';

const colors = require('colors/safe');
const posix = require('posix');

const Bilibili = require('./bilibili.js');
const RoomidHandler = require('./handler/roomidhandler.js');
const { RaffleMonitor, GuardMonitor } = require('./danmu/bilibilisocket.js');
const { GuardController } = require('./danmu/controller.js');
const cprint = require('./util/printer.js');


const raise_nofile_limit = () => {
    let limit = null;

    if (process.platform === 'linux') {
        cprint('Raising nofile limit.', colors.green);
        const hard_limit = posix.getrlimit('nofile')['hard'];
        limit = hard_limit;
        posix.setrlimit('nofile', { 'soft': hard_limit });

        cprint(`Hard limit: ${hard_limit}`, colors.green);
    }

    return limit;
};


/**
const guardCenter = new GuardController(limit);
guardCenter.run();
setTimeout(() => { guardCenter.close(); }, 30 * 1000);
*/

// const roomidHandler = new RoomidHandler();
// Bilibili.getRaffleInRoom(6136246, roomidHandler.handleMessage);

Bilibili.getLiveCount((count) => {
    cprint(count, colors.green);
});

let guardMonitor = new GuardMonitor(7685334, 0);
guardMonitor.run();


/**
Bilibili.getRoomsInArea(1, 5).then((room_waiter) => {

    Promise.all(room_waiter).then((room_vector) => {

        room_vector.forEach((room_list) => {

            room_list.forEach((roomid) => {
                cprint(roomid, colors.green);
            });

        });
    });
}).catch((error) => {

    console.log(error);
});
*/



