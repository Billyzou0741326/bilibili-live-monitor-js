(function() {

    'use strict';

    class History {

        constructor() {
            this.repo = {
                'guard': [],
                'gift': [],
                'pk': [],
            };
            this.almostExpire = {
                'guard': [],
                'gift': [],
                'pk': [],
            };
            this.wait = new Map([
                [ 'guard', 1000 * 60 ],
                [ 'gift', 1000 * 5 ],
                [ 'pk', 1000 * 5 ],
            ]);
            this.checkTask = {
                'guard': null,
                'gift': null,
                'pk': null,
            };

            this.running = false;

            this.bind();
        }

        bind() {
            this.addGift = this.addGift.bind(this);
        }

        get(item) {
            return {
                'valid': this.repo[item],
                'almostExpire': this.almostExpire[item],
            };
        }

        run() {
            if (this.running === false) {
                this.running = true;

                this.checkTask && Object.keys(this.checkTask).forEach(key => {
                    const interval = this.wait.get(key);
                    if (this.checkTask[key] === null) {
                        this.checkTask[key] = setInterval(() => {
                            this.clear(key);
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
            if (gift.type === 'guard') {

                this.repo.guard.push(gift);
            } else if (gift.type === 'pk') {

                this.repo.pk.push(gift);
            } else if (gift.type === 'storm') {
            } else {

                this.repo.gift.push(gift);
            }
        }

        /**
         * @params  target      String      'guard' | 'gift' | 'pk'
         */
        clear(target='guard') {
            if (typeof this.repo[target] === 'undefined') 
                throw new Error(`Repository '${target}' does not exist`);

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
                    return !expired;
                });
            }
        }

    }

    module.exports = History;

})();
