/**
 * CONSTANT-TIME COMPARISON
 * 
 * Purpose: Prevent timing attacks on API key validation
 * 
 * Problem: Simple string comparison reveals key length/prefix
 *   key === userKey -> Different timing for different mismatches
 *   
 * Solution: Compare all bytes, always same time
 *   Constant time: Timing leaked is only ~value equality, not structure
 */

/**
 * Compare two strings in constant time
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} true if equal, false if different
 */
export function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  
  // Convert to buffers for comparison
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  
  // Compare lengths
  if (bufA.length !== bufB.length) {
    return false;
  }
  
  // Time-safe comparison
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  
  return result === 0;
}

/**
 * Validate admin API key
 * @param {string} providedKey - Key from header
 * @param {string} expectedKey - ADMIN_API_KEY environment variable
 * @returns {boolean} true if valid
 */
export function validateAdminKey(providedKey, expectedKey) {
  // Reject if missing
  if (!providedKey || !expectedKey) {
    return false;
  }
  
  // Constant-time comparison
  return constantTimeCompare(providedKey, expectedKey);
}
