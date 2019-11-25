'use strict';


class RateLimter {

    constructor(client) {
        this.queue = [];    // queue.push() queue.shift()
        this.client = client;
        this.RATE = 6;
        this.MAX_TOKENS = 10;

        this.tokens = this.MAX_TOKENS;
        this.updatedAt = +new Date();
    }

    get(options) {
        return this.waitForTokens().then(() => {
            return this.client.get(options);
        });
    }

    waitForTokens() {
        const recurse = (promise) => {
            return promise.then(() => {
                if (this.tokens < 1) {
                    this.addMoreTokens();
                    return recurse(new Promise((resolve) => {
                        setTimeout(() => {
                            resolve();
                        }, 1000);
                    }));
                } else {
                    this.tokens -= 1;
                    return Promise.resolve();
                }
            });
        };
        return recurse(Promise.resolve());
    }

    addMoreTokens() {
        const now = +new Date();
        const timeSinceUpdate = (now - this.updatedAt) / 1000;
        const newTokens = timeSinceUpdate * this.RATE;
        if (newTokens + this.tokens > 1) {
            this.tokens = Math.min(newTokens + this.tokens, this.MAX_TOKENS);
            this.updatedAt = +new Date();
        }
    }
}

module.exports = RateLimter;
