const logger = require('./logger');

class TokenBucket {
  constructor({ tokensPerInterval = 5, interval = 1000 } = {}) {
    this.capacity = tokensPerInterval;
    this.tokens = tokensPerInterval;
    this.interval = interval;
    this.lastRefill = Date.now();
    this.queue = [];
    this.refilling = false;
  }

  _refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    const tokensToAdd = Math.floor(elapsed / this.interval) * this.capacity;
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
    this._drainQueue();
  }

  _drainQueue() {
    while (this.queue.length && this.tokens > 0) {
      const cb = this.queue.shift();
      this.tokens -= 1;
      cb();
    }
  }

  async removeToken() {
    this._refill();
    if (this.tokens > 0) {
      this.tokens -= 1;
      return;
    }
    return new Promise(resolve => {
      this.queue.push(() => resolve());
      // schedule a refill check
      if (!this.refilling) {
        this.refilling = true;
        setTimeout(() => { this.refilling = false; this._refill(); }, this.interval);
      }
    });
  }
}

// Default Google Places limiter: 5 requests / second
const googleLimiter = new TokenBucket({ tokensPerInterval: parseInt(process.env.GOOGLE_RATE_LIMIT || '5', 10), interval: 1000 });

module.exports = { googleLimiter };
