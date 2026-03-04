/**
 * LOG RATE LIMITER
 * 
 * Purpose: Prevent log flood attacks
 * - Identical logs are rate-limited to 1 per minute per key
 * - Prevents DDoS via log spam
 * 
 * Usage:
 *   const limited = rateLimitLog('restaurant_123', 'menu_integrity_violation');
 *   if (limited) logger.error(...);  // Only logs once per minute
 */

const LogRateLimiter = {
  // Map: "key:event" -> { timestamp, count }
  lastLogTime: new Map(),
  
  // Rate limit: 1 log per minute per key
  RATE_LIMIT_MS: 60 * 1000,
  
  /**
   * Check if a log should be emitted
   * @param {string} key - Unique identifier (e.g., restaurantId)
   * @param {string} event - Event type (e.g., 'menu_integrity_violation')
   * @returns {boolean} true if log should be emitted, false if rate-limited
   */
  shouldLog(key, event) {
    const compositeKey = `${key}:${event}`;
    const now = Date.now();
    const lastTime = this.lastLogTime.get(compositeKey);
    
    // First time logging this key:event
    if (!lastTime) {
      this.lastLogTime.set(compositeKey, { timestamp: now, count: 1 });
      return true;
    }
    
    const timeSinceLastLog = now - lastTime.timestamp;
    
    // Within rate limit window - silently drop
    if (timeSinceLastLog < this.RATE_LIMIT_MS) {
      lastTime.count++;
      return false;
    }
    
    // Rate limit window expired - log again and reset
    this.lastLogTime.set(compositeKey, { timestamp: now, count: 1 });
    return true;
  },
  
  /**
   * Get stats on suppressed logs
   * @param {string} key - Unique identifier
   * @param {string} event - Event type
   * @returns {object} { emitted: bool, suppressed: number }
   */
  getStats(key, event) {
    const compositeKey = `${key}:${event}`;
    const entry = this.lastLogTime.get(compositeKey);
    
    if (!entry) {
      return { emitted: 0, suppressed: 0 };
    }
    
    return {
      emitted: 1,
      suppressed: entry.count - 1,
      lastLogTime: entry.timestamp
    };
  },
  
  /**
   * Clear rate limit for testing
   */
  reset() {
    this.lastLogTime.clear();
  },
  
  /**
   * Get all active rate-limited keys
   */
  getActiveKeys() {
    return Array.from(this.lastLogTime.keys());
  }
};

export { LogRateLimiter };
