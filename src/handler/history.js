(function() {

    'use strict';

    class History {

        constructor() {
            this.repo = {
                'guard': [],
                'gift': [],
                'pk': [],
                'storm': [],
            };
            this.almostExpire = {
                'guard': [],
                'gift': [],
                'pk': [],
                'storm': [],
            };
            this.wait = new Map([
                [ 'guard', 1000 * 60 ],
                [ 'gift', 1000 * 5 ],
                [ 'pk', 1000 * 5 ],
                [ 'storm', 1000 * 60 * 2 ],
            ]);
            this.checkTask = {
                'guard': null,
                'gift': null,
                'pk': null,
                'storm': null,
            };

            this.running = false;

            this.bind();
        }

        bind() {
            this.addGift = this.addGift.bind(this);
        }

        isUnique(type, someGift) {
            const giftList = this.getAll(type);
            if (!giftList) return true;

            let valid = true;
            const validList = giftList.valid;
            const nearExpiredList = giftList.almostExpire;
            if (validList) {
                valid = !validList.some(g => (g.id === someGift.id));
                if (valid && nearExpiredList) 
                    valid = !nearExpiredList.some(g => (g.id === someGift.id));
            }
            return valid;
        }

        get(type) {
            let result = this.repo[type] || [];
            result = result.map(gift => {
                const { id, roomid, name, type, expireAt } = gift;
                return { id, roomid, name, type, expireAt };
            });
            return result;
        }

        getAll(type) {
            return {
                'valid': this.repo[type],
                'almostExpire': this.almostExpire[type],
            };
        }

        run() {
            if (this.running === false) {
                this.running = true;

                this.checkTask && Object.keys(this.checkTask).forEach(giftType => {
                    const interval = this.wait.get(giftType);
                    if (this.checkTask[giftType] === null) {
                        this.checkTask[giftType] = setInterval(() => {
                            this.clear(giftType);
                        }, interval);
                    }
                });
            }
        }

        stop() {
            if (this.running === true) {
                Object.keys(this.checkTask).forEach(key => {
                    const task = this.checkTask[key];
                    task && clearInterval(task);
                    this.checkTask[key] = null;
                });
                this.repo.keys().forEach(key => {
                    this.repo[key] = [];
                });
                this.almostExpire.keys().forEach(key => {
                    this.almostExpire[key] = [];
                });
                this.running = false;
            }
        }

        addGift(gift) {
            const installExpiration = (g) => {
                g.expired = () => {
                    return Number.parseInt(0.001 * new Date()) >= g.expireAt;
                };
                g.expireBefore = (time) => {
                    return g.expireAt < time;
                };
            };

            if (gift.type === 'guard') {

                let g = {};
                Object.assign(g, gift);
                installExpiration(g);
                this.repo.guard.push(g);
            } else if (gift.type === 'pk') {

                let g = {};
                Object.assign(g, gift);
                installExpiration(g);
                this.repo.pk.push(g);
            } else if (gift.type === 'storm') {

                let g = {};
                Object.assign(g, gift);
                installExpiration(g);
                this.repo.storm.push(g);
            } else {

                let g = {};
                Object.assign(g, gift);
                installExpiration(g);
                this.repo.gift.push(g);
            }
        }

        /**
         * @params  target      String      'guard' | 'gift' | 'pk'
         */
        clear(target='guard') {
            if (typeof this.repo[target] === 'undefined') 
                throw new Error(`Gift type '${target}' does not exist`);

            let expireIn = 0;
            if (target === 'guard') {
                expireIn = 30;
            } else if (target === 'gift') {
                expireIn = 10;
            } else if (target === 'pk') {
                expireIn = 10;
            }

            this.repo[target] = this.repo[target].filter(gift => {
                const someTime = expireIn + Number.parseInt(0.001 * new Date());
                const nearExpired = gift.expireBefore(someTime);
                if (nearExpired)
                    this.almostExpire[target].push(gift);
                return !nearExpired;
            });
            if (this.almostExpire[target].length > 50) {
                this.almostExpire[target] = this.almostExpire[target].filter(gift => {
                    const expired = gift.expired();
                    return expired === false;
                });
            }
        }

    }

    module.exports = History;

})();
