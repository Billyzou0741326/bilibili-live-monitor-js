(function() {

    'use strict';

    const path = require('path');
    const PouchDB = require('pouchdb');
    PouchDB.plugin(require('pouchdb-find'));

    const Database = require('./database.js');

    /** 
    const db = new PouchDB(path, 'record');
    const index = {
        'index': {
            'fields': [ 'guard' ],
        },
    };
    db.createIndex(index);
    // */

    const db = new Database('record');
    db.getRoomList().then(list => {
        console.log(list);
    });

})();
