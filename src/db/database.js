(function() {

    'use strict';

    const path = require('path');
    const fs = require('fs');

    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    class Database {

        constructor(name) {
            this.name = path.resolve(__dirname, name);
            this.setup();

            this.roomInfo = {};
            this.running = false;
            this.updateTask = null;

            this.bind();
        }

        bind() {
            this.update = this.update.bind(this);
            this.readFile - this.readFile.bind(this);
            this.saveToFile = this.saveToFile.bind(this);
            this.updateLocal = this.updateLocal.bind(this);
            this.filterRooms = this.filterRooms.bind(this);
            this.handleError = this.handleError.bind(this);
        }

        run() {
            if (this.running === false) {
                this.running = true;
                this.updateTask = setInterval(this.update, 1000 * 60 * 5);
            }
        }

        stop() {
            if (this.running === true) {
                if (this.updateTask !== null) {
                    clearInterval(this.updateTask);
                    this.updateTask = null;
                }
                this.running = false;
            }
        }

        setup() {
            if (fs.existsSync(this.name) === false) {
                fs.writeFileSync(this.name, JSON.stringify({}));
            }
        }

        add(roomid) {
            this.roomInfo[roomid] = { 'updated_at': +new Date() };
        }

        destroy() {
            let result = null;
            return Promise.resolve(result);
        }

        update() {
            (this.readFile()
                .then(this.updateLocal)
                .then(this.filterRooms)
                .catch(this.handleError)
                .then(this.saveToFile));
        }

        saveToFile() {
            const data = JSON.stringify(this.roomInfo, null, 4);
            fs.writeFile(this.name, data, error => {
                if (error) {
                    cprint(`Error(database): ${error.message}`, colors.red);
                }
            });
        }

        readFile() {
            const readFileCallback = (resolve, reject) => {
                return (error, data) => {
                    if (error)
                        reject(error);
                    else
                        resolve(data);
                };
            };

            return (() => {
                return new Promise((resolve, reject) => {
                    fs.readFile(this.name, 'utf8', readFileCallback(resolve, reject));
                });
            })();
        }

        updateLocal(data) {
            try {
                const roomInfo = JSON.parse(data);
                Object.keys(roomInfo).forEach(roomid => {
                    if (!this.roomInfo[roomid]) {
                        this.roomInfo[roomid] = roomInfo[roomid];
                    }
                });
            } catch (error) {
                result = Promise.reject(error);
            }
            return data;
        }

        filterRooms(data) {

            const thirtyDays = 1000 * 60 * 60 * 24 * 30;
            let roomInfo = {};
            let result = null;

            try {
                roomInfo = JSON.parse(data);
                result = Object.entries(roomInfo).filter((entry) => {
                    return (new Date() - entry[1].updated_at < thirtyDays);
                }).map((entry) => {
                    return (Number.parseInt(entry[0]));
                });
            } catch (error) {
                result = Promise.reject(error);
            }

            return result;
        }

        handleError(error) {
            switch (error.code) {
                case 'ENOENT':
                    cprint(`Recoverable Error - Database not created`, colors.yellow);
                    break;
                case 'EACCES':
                    cprint(`Error(database) - File Permission required for '${this.name}'`, colors.red);
                    break;
                default:
                    cprint(`Error(database) - ${error.message}`, colors.red);
            }
            return [];
        };

        getRoomList() {

            let promise = null;

            promise = (this.readFile()
                .then(this.updateLocal)
                .then(this.filterRooms)
                .catch(this.handleError));

            return promise;
        }

    }   

    module.exports = Database;

})();

