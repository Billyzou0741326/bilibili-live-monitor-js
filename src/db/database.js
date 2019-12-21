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
            const index = {
                'index': {
                    'fields': [ 'guard' ],
                },
            };
            const query = {
                'selector': {
                    'guard': { $gte: 3 },
                    // 'guard': { $gt: null },
                },
                'fields': [ '_id', 'guard' ],
            };

            return this.db.createIndex(index).then(() => {

                return this.db.find(query);
            }).then(info => {
                
                return info.docs.map(entry => entry['_id']);
            }).catch(error => {

                console.log(error);
                return [];
            });
        }

        close() {
            this.db.close();
        }
    }   

    module.exports = Database;

})();

