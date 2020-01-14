(function() {

    'use strict';

    const cluster = require('cluster');
    const EventEmitter = require('events').EventEmitter;

    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    class AbstractMaster extends EventEmitter {

        constructor() {
            super();
            this.bind();

            this.nameOfId = {};             // id -> name
            this.workerOfId = {};           // id -> WorkerManager
            this.workerOfName = {};         // name -> WorkerManager
            this.isMaster = cluster.isMaster;
        }

        bind() {
            this.onMessage = this.onMessage.bind(this);
        }

        fork(name, env) {
            let workermng = null;

            if (this.isMaster && (name instanceof String || typeof name === 'string')) {
                const worker = cluster.fork(env);
                const id = worker.id;
                workermng = new WorkerManager(worker);
                workermng.on('online', () => {
                    cprint(`${name.toUpperCase()} worker online`, colors.green);
                });

                this.workerOfName[name] = workermng;
                this.workerOfId[id] = workermng;
                this.nameOfId[id] = name;
            }

            return workermng;
        }

        getWorkerByName(name) {
            return this.workerOfName[name] || null;
        }

        getWorkerById(id) {
            return this.workerOfId[id] || null;
        }

        getNameById(id) {
            return this.nameOfId[id] || null;
        }

        onExit(worker, code, signal) {
            const id = worker.id;
            const name = this.nameOfId[id];

            delete this.nameOfId[id];
            delete this.workerOfId[id];
            delete this.workerOfName[name];

            if (name instanceof String || typeof name === 'string') {
                cprint(`${name.toUpperCase()} worker exited with code ${code}`, colors.yellow);
            }
            return id;
        }

        onMessage(worker, msg, handle) {
        }

    }

    // WorkerManager for master process
    class WorkerManager extends EventEmitter {

        constructor(worker) {
            super();
            this.bind();

            this.onlineWaiter = Promise.resolve();

            this.worker = worker || null;
            if (this.worker !== null) {
                this.onlineWaiter = new Promise(resolve => {
                    this.worker.on('online', () => resolve());
                });
                this.worker.on('online', this.onOnline);
                this.worker.on('message', this.onMessage);
                this.worker.on('error', this.onError);
                this.worker.on('exit', this.onExit);
                this.worker.on('disconnect', this.onDisconnect);
            } else {
                cprint('Warning: worker not defined', colors.red);
            }
        }

        waitOnline() {
            return this.onlineWaiter;
        }

        getWorker() {
            return this.worker;
        }

        onOnline(...args) {
            this.emit('online', ...args);
            return this;
        }

        onMessage(...args) {
            this.emit('message', ...args);
            return this;
        }

        onError(...args) {
            this.emit('error', ...args);
            return this;
        }

        onExit(...args) {
            this.emit('exit', ...args);
            return this;
        }

        onDisconnect(...args) {
            this.emit('disconnect', ...args);
            return this;
        }

        bind() {
            this.onOnline = this.onOnline.bind(this);
            this.onMessage = this.onMessage.bind(this);
            this.onError = this.onError.bind(this);
            this.onExit = this.onExit.bind(this);
            this.onDisconnect = this.onDisconnect.bind(this);
            this.waitOnline = this.waitOnline.bind(this);
        }
    }

    module.exports = AbstractMaster;

})();
