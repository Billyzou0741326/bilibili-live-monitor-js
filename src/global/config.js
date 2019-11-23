'use strict';


const EventEmitter = require('events').EventEmitter;


const wsUri = {
    'host': 'tx-live-dmcmt-sv-01.chat.bilibili.com', 
    'port': 2243, 
};

const server = {
    'host': '127.0.0.1', 
    'port': 8999, 
};

const roomidEmitter = new EventEmitter();
const raffleEmitter = new EventEmitter();

const verbose = false;
const debug = false;

module.exports = {
    wsUri, 
    server, 
    roomidEmitter, 
    raffleEmitter, 
    verbose, 
};
