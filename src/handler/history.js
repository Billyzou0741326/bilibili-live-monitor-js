(function() {

    'use strict';

    class History {

        constructor(raffleEmitter) {
            this.repo = {
                'guard': [],
                // 'gift': [],
            };
            this.wait = new Map([
                [ 'guard', 1000 * 60 ],
                [ 'gift', 1000 * 5 ],
            ]);

            this.raffleEmitter = raffleEmitter;
            this.checkTask = [];
            this.running = false;

            this.bind();
        }

        bind() {
            this.addGift = this.addGift.bind(this);
        }

        run() {
            if (this.running === false) {
                this.running = true;

                this.raffleEmitter.on('guard', this.addGift);

                this.checkTask.push(
                    setInterval(() => {
                        this.clear('guard');
                    }, this.wait.get('guard') || 60));
            }
        }

        stop() {
            if (this.running === true) {
                this.raffleEmitter.removeListener('guard', this.addGift);
                this.checkTask.forEach(task => {
                    task && clearInterval(task);
                });
                this.checkTask = [];
                this.running = false;
            }
        }

        addGift(gift) {
            if (gift.type === 'guard')
                this.repo.guard.push(gift);
        }

        clear(target='guard') {
            if (typeof this.repo[target] === 'undefined') 
                throw new Error(`Repository '${target}' does not exist`);

            let expireIn = 0;
            if (target === 'guard') {
                expireIn = 30;
            } else if (target === 'gift') {
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
