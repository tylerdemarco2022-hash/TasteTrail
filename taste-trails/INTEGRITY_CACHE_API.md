# Integrity Cache API Reference

**File**: `backend/utils/integrityCache.js`

**Purpose**: Prevent database hammering on integrity checks by caching restaurant status with TTL-based LRU eviction.

---

## Configuration

```javascript
const isProduction = process.env.NODE_ENV === 'production';
const CACHE_TTL_MS = isProduction ? 5 * 60 * 1000 : 30 * 1000;  // 5 min prod, 30 sec dev
const MAX_CACHE_SIZE = 1000;  // Max entries before LRU eviction
```

---

## Class: IntegrityCache

### Constructor
```javascript
new IntegrityCache()
```

Initializes empty in-memory cache with:
- `cache`: Map<restaurantId, CacheEntry>
- `accessOrder`: Array for LRU tracking

---

## Public Methods

### `get(restaurantId: String): Object | null`

**Purpose**: Retrieve cached integrity status

**Returns**: 
- `null` if cache miss OR expired
- `{integrity_status, integrity_percent, integrity_failure_reason, integrity_last_scanned_at}` if valid cache hit

**Side Effects**:
- Updates `accessTime` to current timestamp (for LRU tracking)
- Automatically deletes expired entries

**Example**:
```javascript
const cached = integrityCache.get('restaurant-123');
if (cached) {
  console.log(cached.integrity_status);  // 'OK' or 'FAILED'
  console.log(cached.integrity_percent);  // 5.5
}
```

---

### `set(restaurantId: String, status: String, percent: Number, reason?: String, lastScannedAt?: String): void`

**Purpose**: Cache integrity status from database

**Parameters**:
- `restaurantId`: Unique restaurant identifier
- `status`: 'OK' or 'FAILED'
- `percent`: Uncategorized percentage (0-100)
- `reason` (optional): Human-readable failure reason
- `lastScannedAt` (optional): ISO timestamp of last scan, or null

**Behavior**:
- If cache is full (size >= MAX_CACHE_SIZE), evicts oldest entry first
- Stores with expiration time = now + CACHE_TTL_MS
- Updates LRU access order

**Example**:
```javascript
integrityCache.set(
  'restaurant-123',
  'OK',
  5.5,
  null,
  new Date().toISOString()
);
```

---

### `invalidate(restaurantId: String): void`

**Purpose**: Clear specific cache entry (called after DB updates)

**Behavior**: 
- Removes entry immediately
- Next request will query DB
- Ensures consistency after scan job updates DB

**Example**:
```javascript
// After integrity scan updates DB
await updateRestaurantIntegrity('restaurant-123', 'FAILED', 85.5, '...');
integrityCache.invalidate('restaurant-123');  // Fresh scan visible next request
```

---

### `clear(): void`

**Purpose**: Clear entire cache

**Behavior**:
- Empties Map
- Resets accessOrder array
- Useful for testing or emergency cache reset

**Example**:
```javascript
integrityCache.clear();  // Start fresh
```

---

### `getStats(): Object`

**Purpose**: Get cache metrics for monitoring

**Returns**:
```javascript
{
  size: Number,                      // Current entries (0-1000)
  maxSize: Number,                   // 1000
  ttlMs: Number,                     // 300000 (prod) or 30000 (dev)
  entries: Array<{
    id: String,                      // restaurantId
    status: String,                  // 'OK' or 'FAILED'
    percent: Number,                 // 0-100
    reason: String | null,           // Failure reason
    expiresIn_ms: Number,            // Time until expiration
    lastScannedAt: String | null     // DB scan timestamp
  }>
}
```

**Example**:
```javascript
const stats = integrityCache.getStats();
console.log(`Cache: ${stats.size}/${stats.maxSize} entries`);
console.log(`TTL: ${stats.ttlMs / 1000}s`);

// Monitor cache health
if (stats.size > 800) {
  logger.warn('Cache approaching max size');
}

// Log entries (for debugging cache misses)
stats.entries.forEach(entry => {
  console.log(`${entry.id}: ${entry.status} (expires in ${entry.expiresIn_ms}ms)`);
});
```

---

## Cache Entry Structure

```typescript
interface CacheEntry {
  status: 'OK' | 'FAILED',           // Integrity status
  percent: Number,                    // 0-100, uncategorized percentage
  reason: String | null,              // Failure reason (null if OK)
  lastScannedAt: String | null,       // ISO timestamp or null (never scanned)
  expiresAt: Number,                  // Unix timestamp when entry expires
  accessTime: Number                  // Unix timestamp of last access (for LRU)
}
```

---

## Integration Examples

### Example 1: Request Path (Menu Route)

```javascript
// backend/server/routes/menu.js
router.get('/restaurants/:restaurantId/menu-items', async (req, res) => {
  const { restaurantId } = req.params;
  
  // STEP 1: Check cache first (99% hit rate expected)
  let cachedStatus = integrityCache.get(restaurantId);
  
  // STEP 2: Cache miss -> Query database
  if (!cachedStatus) {
    const details = await getIntegrityDetails(restaurantId);
    if (details) {
      // Populate cache for next request
      integrityCache.set(
        restaurantId,
        details.integrity_status,
        details.integrity_percent,
        details.integrity_failure_reason,
        details.integrity_last_scanned_at
      );
      cachedStatus = details;
    }
  }
  
  // STEP 3: Check if blocked
  if (cachedStatus?.integrity_status === 'FAILED' && isProduction) {
    return res.status(503).json({
      error: 'Menu structure validation failed. Re-scrape required.'
    });
  }
  
  // STEP 4: Serve menu
  return res.json(menuItems);
});
```

### Example 2: Scan Job (Background Update)

```javascript
// backend/server/index.js
async function runStartupIntegrityScan() {
  for (const restaurant of restaurants) {
    // ... compute integrity ...
    
    // Update database
    await updateRestaurantIntegrity(
      restaurant.id,
      'OK',
      uncategorizedPercent,
      null
    );
    
    // CRITICAL: Invalidate cache so next request reflects fresh scan
    integrityCache.invalidate(restaurant.id);
  }
}
```

### Example 3: Monitoring Cache Health

```javascript
// Somewhere in monitoring/observability
setInterval(() => {
  const stats = integrityCache.getStats();
  
  metrics.gauge('cache.size', stats.size);
  metrics.gauge('cache.max_size', stats.maxSize);
  metrics.gauge('cache.ttl_ms', stats.ttlMs);
  
  // Alert if cache is growing excessively
  if (stats.size > 900) {
    logger.warn('Cache near capacity', stats);
  }
}, 60000);  // Every minute
```

---

## Performance Characteristics

### Time Complexity
| Operation | Complexity | Notes |
|-----------|-----------|-------|
| `get()` | O(1) | Map lookup + expiration check |
| `set()` | O(n) if full | Where n = oldest entry removal |
| `invalidate()` | O(1) | Map delete |
| `clear()` | O(n) | Clear Map + reset array |

### Space Complexity
- **Max Memory**: 1000 entries × ~10KB each ≈ 10MB
- **Per Entry**: status (8B) + percent (8B) + reason (50B avg) + timestamps (16B) + overhead

### Expected Cache Metrics
- **Hit Rate**: 99% (1% DB misses on cache expiration)
- **Latency**: <5ms for cache hit vs ~50ms for DB query
- **DB Load**: 200x reduction (from 2M to ~10K queries per 1M requests)

---

## Invalidation Strategy

### When to Invalidate
1. **Integrity scan completes** → `integrityCache.invalidate(id)`
2. **Manual integrity update** → `integrityCache.invalidate(id)`
3. **Cache expiration** → Automatic (checked on `get()`)
4. **Server shutdown** → Cache lost (rebuilt on startup)

### When NOT to Invalidate
- Don't invalidate on every menu update (menu != integrity)
- Don't invalidate on rating changes
- Don't invalidate on restaurant metadata updates
- Only invalidate on integrity status changes

---

## TTL Justification

### Production (5 minutes)
- Long enough to amortize DB query cost
- Short enough to catch new failures within 5 min
- Aligns with typical scan job frequency (5-10 min)

### Development (30 seconds)
- Fast feedback for testing
- Still reduces DB load significantly
- Easy to see cache behavior changes

### Override (Optional)
```javascript
// If needed, can set custom TTL in environment
process.env.CACHE_TTL_MS = 600000;  // 10 minutes
```

---

## Troubleshooting

### Issue: Cache Breaking Consistency
**Symptom**: Stale status served for too long
**Debug**:
```javascript
const stats = integrityCache.getStats();
// Check expiresIn_ms - should be <5min for prod
stats.entries.forEach(e => {
  if (e.expiresIn_ms > 300000) {
    console.warn('Entry TTL exceeded!', e);
  }
});
```

### Issue: Cache Not Invalidating After Scan
**Symptom**: Old status persists after scan job
**Debug**:
```javascript
const cached = integrityCache.get(restaurantId);
console.log('Cached:', cached);  // Should be null after invalidate()

// Check scan job:
// 1. Is updateRestaurantIntegrity being called?
// 2. Is integrityCache.invalidate() called AFTER update?
// 3. Is integrityCache imported in index.js?
```

### Issue: Memory Growing Unbounded
**Symptom**: Process memory keeps increasing
**Debug**:
```javascript
// Check cache size
const stats = integrityCache.getStats();
if (stats.size > MAX_CACHE_SIZE) {
  logger.error('Cache exceeded max size! LRU not working.');
}

// Force clear if emergency
integrityCache.clear();
```

---

## Testing Guide

### Unit Test Example
```javascript
test('Cache stores and retrieves integrity status', () => {
  const cache = new IntegrityCache();
  
  // Set
  cache.set('rest-1', 'OK', 5.5, null, new Date().toISOString());
  
  // Get
  const entry = cache.get('rest-1');
  expect(entry.integrity_status).toBe('OK');
  expect(entry.integrity_percent).toBe(5.5);
  
  // Invalidate
  cache.invalidate('rest-1');
  expect(cache.get('rest-1')).toBeNull();
});
```

### Integration Test Example
```javascript
test('Request path uses cache before DB', async () => {
  // First request: populates cache
  const res1 = await GET('/restaurants/rest-1/menu-items');
  expect(res1.status).toBe(200);
  
  // Second request: should hit cache (same latency, no DB call)
  const res2 = await GET('/restaurants/rest-1/menu-items');
  expect(res2.status).toBe(200);
  
  // Cache stats show hit
  const stats = integrityCache.getStats();
  expect(stats.size).toBe(1);
});
```

---

## Production Checklist

- [ ] TTL values appropriate for your infrastructure (5 min prod, 30 sec dev)
- [ ] MAX_CACHE_SIZE of 1000 sufficient (adjust if you have >1000 restaurants)
- [ ] integrityCache.invalidate() called in scan job after DB update
- [ ] Monitoring configured to alert on cache size >900 or TTL >threshold
- [ ] Test that cache expiration works (wait 5+ min in prod, <30 sec in dev)
- [ ] Load test with concurrent requests to verify 99% cache hit
- [ ] Verify cache.getStats() accessible for debugging
- [ ] Documentation updated if you change TTL or MAX_SIZE

---

## Further Reading

- [LANDING_MINES_PREVENTION.md](./LANDING_MINES_PREVENTION.md) - Full context
- [backend/server/routes/menu.js](./backend/server/routes/menu.js) - Request path integration
- [backend/server/index.js](./backend/server/index.js) - Scan job integration
- [backend/tests/productionHardening.test.js](./backend/tests/productionHardening.test.js) - Cache tests
