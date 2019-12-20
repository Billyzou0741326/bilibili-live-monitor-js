'use strict';


const settings = require('../settings.json');
const EventEmitter = require('events').EventEmitter;
const History = require('../handler/history.js');

const wsUri = {
    'host': 'broadcastlv.chat.bilibili.com', 
    'port': 2243, 
};

const wsServer = {
    'host': settings['wsServer']['ip'] || '0.0.0.0', 
    'port': settings['wsServer']['port'] || 8999, 
};
const httpServer = {
    'host': settings['httpServer']['ip'] || '0.0.0.0',
    'port': settings['httpServer']['port'] || 9001,
};

const roomidEmitter = new EventEmitter();
const raffleEmitter = new EventEmitter();
const repository = new History(raffleEmitter);

const verbose = false;
const debug = false;

const error = {
    'count': 0,
};

module.exports = {
    wsUri, 
    wsServer, 
    httpServer,
    roomidEmitter, 
    raffleEmitter, 
    repository,
    verbose, 
    debug, 
    error,
};
