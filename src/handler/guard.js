(function() {

    'use strict';

    class GuardBuilder {

        static start() {
            return new GuardBuilder();
        }

        build() {
            this.id = this.id || 0;
            this.roomid = this.roomid || 0;
            this.type = this.type || '';
            this.name = this.name || '';
            this.expireAt = this.expireAt || 0;
            return new Guard(this);
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

    class Guard {

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

    module.exports = GuardBuilder;

})();
