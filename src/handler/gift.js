(function() {

    'use strict';

    const GuardBuilder = require('./guard.js');

    class GiftBuilder {

        static start() {
            return new GiftBuilder();
        }

        build() {
            this.id = this.id || 0;
            this.roomid = this.roomid || 0;
            this.type = this.type || '';
            this.name = this.name || '';
            this.expireAt = this.expireAt || 0;
            return new Gift(this);
        }

        withId(id) {
            this.id = id;
            return this;
        }

        withRoomid(roomid) {
            this.roomid = roomid;
            return this;
        }

        withType(type) {
            this.type = type;
            return this;
        }

        withName(name) {
            this.name = name;
            return this;
        }

        withExpireAt(expireAt) {
            this.expireAt = expireAt;
            return this;
        }

    }

    class Gift {

        constructor(options) {
            // id, roomid, type, name, expireAt
            Object.assign(this, options);
            Object.freeze(this);
        }

        expired() {
            return Number.parseInt(+new Date() / 1000) >= expireAt;
        }

        expireBefore(time) {
            return expireAt < time;
        }

    }

    module.exports = GiftBuilder;

})();
