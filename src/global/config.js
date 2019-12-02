'use strict';


const EventEmitter = require('events').EventEmitter;


const wsUri = {
    'host': 'broadcastlv.chat.bilibili.com', 
    'port': 2243, 
};

const server = {
    'host': '0.0.0.0', 
    'port': 8999, 
};

const roomidEmitter = new EventEmitter();
const raffleEmitter = new EventEmitter();

const verbose = false;
const debug = false;

const error = {
    'count': 0,
};

module.exports = {
    wsUri, 
    server, 
    roomidEmitter, 
    raffleEmitter, 
    verbose, 
    debug, 
    error,
};
