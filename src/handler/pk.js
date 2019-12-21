(function() {

    'use strict';

    const GuardBuilder = require('./guard.js');

    class PKBuilder extends GuardBuilder {

        static start() {
            return new PKBuilder();
        }

        build() {
            super.build();
            return new PK(this);
        }

    }

    class PK {

        constructor(options) {
            // id, roomid, type, name, expireAt
            Object.assign(this, options);
            Object.freeze(this);
        }

        expired() {
            return Number.parseInt(0.001 * new Date()) >= this.expireAt;
        }

        expireBefore(time) {
            return this.expireAt < time;
        }

    }

    module.exports = PKBuilder;

})();
