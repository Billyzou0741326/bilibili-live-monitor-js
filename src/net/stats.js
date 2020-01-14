(function() {

    'use strict';

    class Stats {

        constructor() {
            this.stats = {};
        }

        add(url) {
            if (Number.isInteger(this.stats[url]) === false) {
                this.stats[url] = 0;
            }
            ++this.stats[url];
        }

        toString() {
            const keys = Object.keys(this.stats);
            let str = '';
            if (keys.length > 0) {
                str = JSON.stringify(this.stats, null, 4);
            }
            return str;
        }
    }

    module.exports = Stats;

})();
