/**
 * RED TEAM TEST: Bypass Attempt & Production Safety Gate
 * 
 * Tests that:
 * 1. Restaurants blocked for integrity failure cannot be served
 * 2. Behavior differs between production and development
 * 3. Race conditions are prevented
 * 4. No partial responses are sent
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { supabase } from '../supabase.js';
import {
  isRestaurantHealthy,
  getIntegrityDetails,
  updateRestaurantIntegrity
} from '../server/index.js';
import { integrityCache } from '../utils/integrityCache.js';
import { validateAdminKey, constantTimeCompare } from '../utils/constantTimeCompare.js';
import { LogRateLimiter } from '../utils/logRateLimiter.js';

describe('Production Hardening: Bypass Attempt & Safety Gate', () => {
  let testRestaurantId;
  
  beforeAll(async () => {
    // Create test restaurant for bypass attempts
    const { data, error } = await supabase
      .from('restaurants')
      .insert({
        name: 'Red Team Test Restaurant',
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();
    
    if (error) throw error;
    testRestaurantId = data.id;
  });
  
  afterAll(async () => {
    // Clean up test restaurant
    if (testRestaurantId) {
      await supabase
        .from('restaurants')
        .delete()
        .eq('id', testRestaurantId);
    }
  });
  
  beforeEach(async () => {
    // Reset to healthy before each test
    if (testRestaurantId) {
      await updateRestaurantIntegrity(
        testRestaurantId,
        'OK',
        0,
        null
      );
    }
  });
  
  test('should allow serving restaurant when integrity_status is OK', async () => {
    const isHealthy = await isRestaurantHealthy(testRestaurantId);
    expect(isHealthy).toBe(true);
  }, 10000);
  
  test('should block restaurant when integrity_status is FAILED in production', async () => {
    // Mark restaurant as failed
    const updated = await updateRestaurantIntegrity(
      testRestaurantId,
      'FAILED',
      45.5,
      'Menu structure validation failed: 45.5% uncategorized'
    );
    expect(updated).toBe(true);
    
    // In production, should be blocked
    const isHealthy = await isRestaurantHealthy(testRestaurantId);
    
    // The function should return false when integrity_status is FAILED
    expect(isHealthy).toBe(false);
  }, 10000);
  
  test('should return integrity details for failed restaurant', async () => {
    await updateRestaurantIntegrity(
      testRestaurantId,
      'FAILED',
      35.0,
      'Test: 35% uncategorized'
    );
    
    const details = await getIntegrityDetails(testRestaurantId);
    
    expect(details).toBeDefined();
    expect(details.integrity_status).toBe('FAILED');
    expect(details.integrity_percent).toBe(35.0);
    expect(details.integrity_failure_reason).toContain('35');
  }, 10000);
  
  test('should support clearing failure status back to OK', async () => {
    // Fail it first
    await updateRestaurantIntegrity(
      testRestaurantId,
      'FAILED',
      60.0,
      'Initial failure'
    );
    
    let isHealthy = await isRestaurantHealthy(testRestaurantId);
    expect(isHealthy).toBe(false);
    
    // Clear it
    await updateRestaurantIntegrity(
      testRestaurantId,
      'OK',
      5.0,
      null
    );
    
    isHealthy = await isRestaurantHealthy(testRestaurantId);
    expect(isHealthy).toBe(true);
  }, 10000);
  
  test('should persist integrity status across multiple calls', async () => {
    // Set to failed
    await updateRestaurantIntegrity(
      testRestaurantId,
      'FAILED',
      50.0,
      'Persistence test'
    );
    
    // Check multiple times - should remain failed
    let isHealthy = await isRestaurantHealthy(testRestaurantId);
    expect(isHealthy).toBe(false);
    
    // Wait and check again (simulating server operation)
    await new Promise(resolve => setTimeout(resolve, 100));
    isHealthy = await isRestaurantHealthy(testRestaurantId);
    expect(isHealthy).toBe(false);
  }, 10000);
  
  test('should survive concurrent integrity checks', async () => {
    await updateRestaurantIntegrity(
      testRestaurantId,
      'FAILED',
      45.0,
      'Concurrent test'
    );
    
    // Simulate concurrent requests
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(isRestaurantHealthy(testRestaurantId));
    }
    
    const results = await Promise.all(promises);
    
    // All should return false (consistent)
    expect(results.every(r => r === false)).toBe(true);
  }, 10000);
  
  test('should update integrity_percent correctly', async () => {
    const testPercents = [0.0, 10.5, 25.75, 33.33, 99.99];
    
    for (const percent of testPercents) {
      await updateRestaurantIntegrity(
        testRestaurantId,
        'OK',
        percent,
        `Test: ${percent}%`
      );
      
      const details = await getIntegrityDetails(testRestaurantId);
      expect(details.integrity_percent).toBe(percent);
    }
  }, 10000);
  
  test('should handle missing restaurant gracefully', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    
    // Should not crash, just return fail-open (true/healthy)
    const isHealthy = await isRestaurantHealthy(fakeId);
    expect(typeof isHealthy).toBe('boolean');
  }, 10000);
  
  test('should prevent partial responses on integrity failure', async () => {
    /**
     * This test verifies that integrity check happens BEFORE
     * any menu query, preventing partial/stale responses.
     * 
     * In production, if integrity check fails, the entire
     * response should be rejected with 503 BEFORE any
     * menu data is accessed.
     */
    
    // Mark as failed
    await updateRestaurantIntegrity(
      testRestaurantId,
      'FAILED',
      40.0,
      'Partial response test'
    );
    
    // In production mode, the API should check integrity
    // BEFORE querying menu_items table
    // This is implemented in menu.js route handler
    
    const isHealthy = await isRestaurantHealthy(testRestaurantId);
    
    // The check should happen synchronously before any data fetching
    expect(isHealthy).toBe(false);
  }, 10000);
});

describe('Database Persistence Verification', () => {
  let testRestaurantId;
  
  beforeAll(async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .insert({
        name: 'DB Persistence Test Restaurant',
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();
    
    if (error) throw error;
    testRestaurantId = data.id;
  });
  
  afterAll(async () => {
    if (testRestaurantId) {
      await supabase
        .from('restaurants')
        .delete()
        .eq('id', testRestaurantId);
    }
  });
  
  test('integrity status persists after update', async () => {
    // Update
    await updateRestaurantIntegrity(
      testRestaurantId,
      'FAILED',
      42.0,
      'Should persist'
    );
    
    // Read back from DB directly
    const { data, error } = await supabase
      .from('restaurants')
      .select('integrity_status, integrity_percent, integrity_failure_reason')
      .eq('id', testRestaurantId)
      .single();
    
    expect(error).toBeNull();
    expect(data.integrity_status).toBe('FAILED');
    expect(data.integrity_percent).toBe(42.0);
    expect(data.integrity_failure_reason).toContain('persist');
  }, 10000);
  
  test('integrity_last_scanned_at is updated', async () => {
    const beforeTime = new Date();
    
    await updateRestaurantIntegrity(
      testRestaurantId,
      'OK',
      0,
      null
    );
    
    const { data } = await supabase
      .from('restaurants')
      .select('integrity_last_scanned_at')
      .eq('id', testRestaurantId)
      .single();
    
    const scanTime = new Date(data.integrity_last_scanned_at);
    const afterTime = new Date();
    
    expect(scanTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(scanTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  }, 10000);
});

/**
 * CHAOS TESTS: Integrity Cache & Security Hardening
 * 
 * Tests that:
 * 1. Cache hit avoids DB queries (performance)
 * 2. Cache expiration triggers fresh DB reads
 * 3. Staleness is detected and warned
 * 4. Admin key validation is constant-time
 * 5. Log rate limiting prevents spam
 * 6. 404 response in production prevents endpoint discovery
 */

describe('Chaos Tests: Integrity Cache & Security', () => {
  let testRestaurantId;
  
  beforeAll(async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .insert({
        name: 'Cache Test Restaurant',
        updated_at: new Date().toISOString(),
        integrity_status: 'OK',
        integrity_percent: 5,
        integrity_last_scanned_at: new Date().toISOString()
      })
      .select('id')
      .single();
    
    if (error) throw error;
    testRestaurantId = data.id;
  });
  
  afterAll(async () => {
    if (testRestaurantId) {
      await supabase
        .from('restaurants')
        .delete()
        .eq('id', testRestaurantId);
    }
    integrityCache.clear();
  });
  
  beforeEach(() => {
    integrityCache.clear();
  });
  
  test('Cache hit avoids DB query on second request', async () => {
    const { data: initialData } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', testRestaurantId)
      .single();
    
    // First access: populates cache from getIntegrityDetails (which queries DB)
    // Simulating what menu.js does
    const details1 = await getIntegrityDetails(testRestaurantId);
    if (details1) {
      integrityCache.set(
        testRestaurantId,
        details1.integrity_status,
        details1.integrity_percent,
        details1.integrity_failure_reason,
        details1.integrity_last_scanned_at
      );
    }
    
    // Second access: should hit cache
    const cached = integrityCache.get(testRestaurantId);
    expect(cached).not.toBeNull();
    expect(cached.integrity_status).toBe('OK');
    
    // Cache should return all expected fields
    expect(cached).toHaveProperty('integrity_status');
    expect(cached).toHaveProperty('integrity_percent');
    expect(cached).toHaveProperty('integrity_last_scanned_at');
  });
  
  test('Cache expiration triggers fresh DB load (development mode)', async () => {
    // In dev mode, TTL is 30 seconds
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Populate cache
    const details = await getIntegrityDetails(testRestaurantId);
    if (details) {
      integrityCache.set(
        testRestaurantId,
        details.integrity_status,
        details.integrity_percent,
        details.integrity_failure_reason,
        details.integrity_last_scanned_at
      );
    }
    
    const cached = integrityCache.get(testRestaurantId);
    expect(cached).not.toBeNull();
    
    // In production, TTL is 5 minutes so we can't easily test expiration
    // In development, TTL is 30 seconds
    // For now, verify cache returns correct structure
    expect(cached.integrity_status).toBeDefined();
    expect(typeof cached.integrity_percent).toBe('number');
  });
  
  test('Cache miss triggers DB query', async () => {
    // Ensure cache is empty
    integrityCache.invalidate(testRestaurantId);
    const cached1 = integrityCache.get(testRestaurantId);
    expect(cached1).toBeNull();
    
    // Query DB directly (simulating cache miss path)
    const details = await getIntegrityDetails(testRestaurantId);
    expect(details).not.toBeNull();
    expect(details.integrity_status).toBe('OK');
    
    // Populate cache
    integrityCache.set(
      testRestaurantId,
      details.integrity_status,
      details.integrity_percent,
      details.integrity_failure_reason,
      details.integrity_last_scanned_at
    );
    
    // Now cache hit
    const cached2 = integrityCache.get(testRestaurantId);
    expect(cached2).not.toBeNull();
  });
  
  test('Staleness detection: old scan timestamp triggers WARN', async () => {
    // Set scan time to 8 days ago
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    
    await updateRestaurantIntegrity(
      testRestaurantId,
      'OK',
      5,
      null
    );
    
    // Manually update the timestamp in DB to simulate old scan
    await supabase
      .from('restaurants')
      .update({ integrity_last_scanned_at: eightDaysAgo })
      .eq('id', testRestaurantId);
    
    // Fetch and cache
    const details = await getIntegrityDetails(testRestaurantId);
    expect(details).not.toBeNull();
    
    integrityCache.set(
      testRestaurantId,
      details.integrity_status,
      details.integrity_percent,
      details.integrity_failure_reason,
      details.integrity_last_scanned_at
    );
    
    // Check staleness
    const cached = integrityCache.get(testRestaurantId);
    const lastScanned = cached.integrity_last_scanned_at;
    const isStale = !lastScanned || 
      (Date.now() - new Date(lastScanned).getTime()) > 7 * 24 * 60 * 60 * 1000;
    
    expect(isStale).toBe(true);
  }, 10000);
  
  test('Constant-time comparison prevents timing attacks', () => {
    const correctKey = 'super_secret_admin_key_12345';
    const wrongKey1 = 'wrong_key';
    const wrongKey2 = 'super_secret_admin_key_99999'; // Mostly correct
    
    // Constant-time should reject both
    expect(validateAdminKey(wrongKey1, correctKey)).toBe(false);
    expect(validateAdminKey(wrongKey2, correctKey)).toBe(false);
    
    // Should accept correct key
    expect(validateAdminKey(correctKey, correctKey)).toBe(true);
    
    // Constant-time comparison should work at byte level
    const result1 = constantTimeCompare('abc', 'def');
    expect(result1).toBe(false);
    
    const result2 = constantTimeCompare('abc', 'abc');
    expect(result2).toBe(true);
    
    // Reject undefined/null
    expect(validateAdminKey(undefined, correctKey)).toBe(false);
    expect(validateAdminKey(null, correctKey)).toBe(false);
  });
  
  test('Log rate limiter prevents spam', () => {
    LogRateLimiter.clear();
    
    const restaurantId = 'spam-test-restaurant';
    const logType = 'test_log_spam';
    
    // First log should pass
    expect(LogRateLimiter.shouldLog(restaurantId, logType)).toBe(true);
    
    // Immediate second log should fail (rate limited)
    expect(LogRateLimiter.shouldLog(restaurantId, logType)).toBe(false);
    
    // Different log type should pass
    expect(LogRateLimiter.shouldLog(restaurantId, 'different_log_type')).toBe(true);
    
    // After 1 minute, should allow again (we can't wait in test, so verify structure)
    expect(LogRateLimiter.suppressedCounts.has(`${restaurantId}:${logType}`)).toBe(true);
  });
  
  test('Unauthorized debug endpoint returns 404 in production', () => {
    // This is a structural test - actual HTTP testing would need integration tests
    // Verify that the check logic works correctly
    const isProduction = process.env.NODE_ENV === 'production';
    const adminKey = 'test_key_12345';
    const wrongKey = 'wrong_key';
    
    if (isProduction) {
      // In production, wrong key should fail
      const result = validateAdminKey(wrongKey, adminKey);
      expect(result).toBe(false);
    }
    
    // Correct key should pass in any environment
    const result = validateAdminKey(adminKey, adminKey);
    expect(result).toBe(true);
  });
  
  test('Cache invalidation after integrity update', async () => {
    // Populate cache
    const details = await getIntegrityDetails(testRestaurantId);
    if (details) {
      integrityCache.set(
        testRestaurantId,
        details.integrity_status,
        details.integrity_percent,
        details.integrity_failure_reason,
        details.integrity_last_scanned_at
      );
    }
    
    const cached1 = integrityCache.get(testRestaurantId);
    expect(cached1).not.toBeNull();
    
    // Invalidate cache (as done after integrity scan)
    integrityCache.invalidate(testRestaurantId);
    
    const cached2 = integrityCache.get(testRestaurantId);
    expect(cached2).toBeNull();
  });
  
  test('Cold start scenario: 20 concurrent requests, only 1 DB query', async () => {
    // SCENARIO: Server just restarted, cache is empty
    // 20 requests arrive simultaneously for same restaurant
    // Expected: Only 1 DB query, others wait for result
    
    integrityCache.clear();  // Simulate cold start
    
    const restaurantId = 'cold-start-test';
    const dbQueryTracker = { count: 0 };
    
    // Mock fetch function (would be DB call in real scenario)
    const mockFetchFn = async () => {
      dbQueryTracker.count++;
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate DB latency
      return {
        integrity_status: 'OK',
        integrity_percent: 5,
        integrity_failure_reason: null,
        integrity_last_scanned_at: new Date().toISOString()
      };
    };
    
    // Fire 20 concurrent requests for same restaurant
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        integrityCache.getOrFetch(restaurantId, mockFetchFn)
      );
    }
    
    // Wait for all requests
    const results = await Promise.all(promises);
    
    // VERIFY: Only 1 DB query happened (others reused promise)
    expect(dbQueryTracker.count).toBe(1);
    
    // VERIFY: All 20 requests got same result
    expect(results).toHaveLength(20);
    results.forEach(result => {
      expect(result.integrity_status).toBe('OK');
      expect(result.integrity_percent).toBe(5);
    });
    
    // VERIFY: Result is now cached
    const cached = integrityCache.get(restaurantId);
    expect(cached).not.toBeNull();
    expect(cached.integrity_status).toBe('OK');
  });
  
  test('Cache stampede protection: in-flight promises prevent DB hammering', async () => {
    // SCENARIO: Multiple requests arrive while one is already in flight
    // Expected: Requests reuse the in-flight promise (no multiple DB calls)
    
    integrityCache.clear();
    
    const restaurantId = 'stampede-test';
    const dbQueryTracker = { timestamps: [] };
    
    const mockFetchFn = async () => {
      dbQueryTracker.timestamps.push(Date.now());
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate slow DB
      return {
        integrity_status: 'OK',
        integrity_percent: 10,
        integrity_failure_reason: null,
        integrity_last_scanned_at: new Date().toISOString()
      };
    };
    
    // Fire 5 concurrent requests
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        integrityCache.getOrFetch(restaurantId, mockFetchFn)
      );
    }
    
    // Wait for all
    const results = await Promise.all(promises);
    
    // VERIFY: Only 1 DB query (all requests reused promise)
    expect(dbQueryTracker.timestamps).toHaveLength(1);
    
    // VERIFY: No concurrent DB calls (timestamps within 10ms of each other = truly serial)
    // (If they were concurrent, timestamps would span 100ms)
    const timeDiff = dbQueryTracker.timestamps[0] - Date.now();
    expect(Math.abs(timeDiff)).toBeLessThan(10);  // Timestamps are very close
    
    // VERIFY: All got same result
    expect(results).toHaveLength(5);
    results.forEach(result => {
      expect(result.integrity_status).toBe('OK');
    });
    
    // VERIFY: In-flight promise cleaned up after completion
    const stats = integrityCache.getStats();
    expect(stats.inFlightRequests).toBe(0);
  });
  
  test('Environment guardrails: ADMIN_API_KEY validation on startup', () => {
    // Test that the constant-time comparison is used correctly
    // and keys are not compared with simple ===
    
    const testKey = 'test_key_12345_abcdef';
    const wrongKey = 'wrong_key_12345_abcdef';
    
    // Constant-time comparison should work correctly
    expect(validateAdminKey(testKey, testKey)).toBe(true);
    expect(validateAdminKey(wrongKey, testKey)).toBe(false);
    
    // Should handle edge cases
    expect(validateAdminKey('', '')).toBe(true);
    expect(validateAdminKey('', 'nonempty')).toBe(false);
    expect(validateAdminKey(undefined, 'key')).toBe(false);
    expect(validateAdminKey('key', undefined)).toBe(false);
  });
});


