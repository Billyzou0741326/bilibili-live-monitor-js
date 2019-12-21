(function() {

    'use strict';

    class History {

        constructor(raffleEmitter) {
            this.repo = {
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

            this.raffleEmitter = raffleEmitter || null;
            this.running = false;

            this.bind();
        }

        bind() {
            this.addGift = this.addGift.bind(this);
        }

        get(item) {
            return this.repo[item];
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
                this.raffleEmitter.removeListener('guard', this.addGift);
                Object.keys(this.checkTask).forEach(key => {
                    const task = this.checkTask[key];
                    task && clearInterval(task);
                    this.checkTask[key] = null;
                });
                this.repo.keys().forEach(key => {
                    this.repo[key] = null;
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
                return !gift.expireBefore(someTime);
            });
        }

    }

    module.exports = History;

})();
