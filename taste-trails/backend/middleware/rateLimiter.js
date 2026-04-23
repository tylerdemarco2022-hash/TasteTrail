/**
 * Simple In-Memory Rate Limiter
 * Tracks requests per IP per minute
 * 
 * PHASE 15: Security Hardening
 */

const requestCounts = new Map(); // IP -> { count, resetTime }
const REQUESTS_PER_MINUTE = 60;
const MINUTE_MS = 60 * 1000;

/**
 * Create rate limiting middleware for an endpoint
 * @param {number} maxRequests - Max requests per minute (default 60)
 * @returns {Function} Express middleware
 */
export function createRateLimiter(maxRequests = REQUESTS_PER_MINUTE) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    // Get or initialize request tracking for this IP
    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, { count: 0, resetTime: now + MINUTE_MS });
    }

    const tracker = requestCounts.get(ip);

    // Reset if minute has passed
    if (now >= tracker.resetTime) {
      tracker.count = 0;
      tracker.resetTime = now + MINUTE_MS;
    }

    // Check if limit exceeded
    if (tracker.count >= maxRequests) {
      const secondsUntilReset = Math.ceil((tracker.resetTime - now) / 1000);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: secondsUntilReset,
        message: `Too many requests. Try again in ${secondsUntilReset} seconds.`
      });
    }

    // Increment counter
    tracker.count++;

    // Add rate limit info to response headers
    res.set('X-RateLimit-Limit', maxRequests.toString());
    res.set('X-RateLimit-Remaining', (maxRequests - tracker.count).toString());
    res.set('X-RateLimit-Reset', Math.ceil(tracker.resetTime / 1000).toString());

    next();
  };
}

/**
 * Check if IP has attempted same action recently
 * @param {string} ip - IP address
 * @param {string} action - Action type (e.g., 'flag-closed-123')
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} True if action was performed within window
 */
export function hasRecentAction(ip, action, windowMs = 24 * 60 * 60 * 1000) {
  const key = `${ip}:${action}`;
  
  if (!requestCounts.has(key)) {
    // First time - record it
    requestCounts.set(key, Date.now());
    return false;
  }

  const lastAction = requestCounts.get(key);
  const now = Date.now();
  
  if (now - lastAction > windowMs) {
    // Window expired - update and allow
    requestCounts.set(key, now);
    return false;
  }

  // Still within window - deny
  return true;
}

/**
 * Record action for duplicate prevention
 * @param {string} ip - IP address
 * @param {string} action - Action type
 */
export function recordAction(ip, action) {
  const key = `${ip}:${action}`;
  requestCounts.set(key, Date.now());
}

/**
 * Cleanup old entries periodically (prevent memory leak)
 * Call this every few hours
 */
export function cleanupOldEntries() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  for (const [key, value] of requestCounts.entries()) {
    // Handle both timestamp values and tracker objects
    const entryTime = typeof value === 'object' ? value.resetTime : value;
    
    if (now - entryTime > maxAge) {
      requestCounts.delete(key);
    }
  }
}

// Auto-cleanup every hour
setInterval(cleanupOldEntries, 60 * 60 * 1000);

export default createRateLimiter;
