(function() {

    'use strict';

    const path = require('path');
    const PouchDB = require('pouchdb');
    PouchDB.plugin(require('pouchdb-find'));
    PouchDB.plugin(require('pouchdb-upsert'));

    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    class Database {

        constructor(name) {
            this.name = path.resolve(__dirname, name);
            this.db = null;
            this.setup();
        }   

        setup() {
            this.db = this.db || new PouchDB(this.name);
            return this;
        }

        update(roomid, type) {
            const id = '' + roomid;
            this.db && this.db.upsert(id, (doc) => {
                return this.upsertOperation(doc, type);
            }).catch(error => {
                cprint(`Error(database): ${error.message}`, colors.red);
            });
        }

        upsertOperation(doc, type) {
            doc[type] = doc[type] || 0;
            doc['updated_at'] = +new Date();
            ++doc[type];
            return doc;
        }

        getRoomList() {
            if (!this.db) return Promise.resolve([]);

            const oneDay = 1000 * 60 * 60 * 24;
            const index = {
                'index': {
                    'fields': [ 'guard', 'updated_at' ],
                },
            };
            const query = {
                'selector': {
                    'guard': { $gte: 3 },
                    'updated_at': { $gt: (new Date() - oneDay) },
                    // 'guard': { $gt: null },
                },
                'fields': [ '_id', 'guard' ],
            };

            return this.db.createIndex(index).then(() => {

                return this.db.find(query);
            }).then(info => {
                
                return info.docs.map(entry => entry['_id']);
            }).catch(error => {

                cprint(`Error(database): ${error.message}`, colors.red);
                return [];
            });
        }

        destroy() {
            let result = null;
            if (this.db) {
                result = this.db.destroy().catch(error => {
                    cprint(`Error: ${error.message}`, colors.red);
                });
                this.db = null;
            }
            return Promise.resolve(result);
        }

        close() {
            this.db && this.db.close();
            this.db = null;
        }
    }   

    module.exports = Database;

})();

