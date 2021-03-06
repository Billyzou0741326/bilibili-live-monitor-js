(function() {

    'use strict';

    const GuardBuilder = require('./guard.js');

    class GiftBuilder extends GuardBuilder {

        static start() {
            return new GiftBuilder();
        }

        build() {
            super.build();
            return new Gift(this);
        }

    }

    class Gift {

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

    module.exports = GiftBuilder;

})();
