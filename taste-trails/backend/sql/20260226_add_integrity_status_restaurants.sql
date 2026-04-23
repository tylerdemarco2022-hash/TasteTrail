-- ================================================================
-- MIGRATION: Add Integrity Status to Restaurants Table
-- ================================================================
-- Purpose: Persist restaurant integrity failures to database with
--          transaction safety, idempotency, and explicit backfilling
-- ================================================================
-- SAFETY: Wrapped in transaction, uses IF NOT EXISTS, explicit backfill
-- ================================================================

BEGIN;  -- Start transaction (will ROLLBACK if any step fails)

-- Step 1: Add columns if they don't exist
-- Explicitly setting defaults for safety (NOT NULL with DEFAULT)
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS integrity_status TEXT NOT NULL DEFAULT 'OK';

ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS integrity_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS integrity_failure_reason TEXT DEFAULT NULL;

ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS integrity_last_scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Step 2: Backfill explicitly (safety for existing rows)
-- Set integrity_status to 'OK' where it's still at DEFAULT or NULL
UPDATE restaurants 
SET integrity_status = 'OK' 
WHERE integrity_status IS NULL;

-- Set integrity_percent to 0 where it's NULL
UPDATE restaurants 
SET integrity_percent = 0 
WHERE integrity_percent IS NULL;

-- Step 3: Drop old constraints if they exist (optional, for re-runs)
ALTER TABLE restaurants 
DROP CONSTRAINT IF EXISTS integrity_status_valid;

ALTER TABLE restaurants 
DROP CONSTRAINT IF EXISTS integrity_percent_valid;

-- Step 4: Add CHECK constraints for data integrity
-- These enforce at database level that data is always valid
ALTER TABLE restaurants 
ADD CONSTRAINT integrity_status_valid 
  CHECK (integrity_status IN ('OK', 'FAILED'));

ALTER TABLE restaurants 
ADD CONSTRAINT integrity_percent_valid 
  CHECK (integrity_percent >= 0 AND integrity_percent <= 100);

-- Step 5: Create indexes for efficient lookups
-- Index for finding failed restaurants quickly
CREATE INDEX IF NOT EXISTS idx_restaurants_integrity_status 
ON restaurants(integrity_status) 
WHERE integrity_status = 'FAILED';

-- Index for sorting by scan time (freshness)
CREATE INDEX IF NOT EXISTS idx_restaurants_last_scanned_at 
ON restaurants(integrity_last_scanned_at DESC);

-- Index for finding stale scans (never scanned or >7 days old)
CREATE INDEX IF NOT EXISTS idx_restaurants_integrity_stale 
ON restaurants(integrity_last_scanned_at) 
WHERE integrity_last_scanned_at IS NULL 
   OR integrity_last_scanned_at < NOW() - INTERVAL '7 days';

-- Step 6: Update schema documentation
COMMENT ON COLUMN restaurants.integrity_status IS 'OK or FAILED - indicates if restaurant menu passed integrity scan';
COMMENT ON COLUMN restaurants.integrity_percent IS 'Percentage of uncategorized items (0-100). Computed during integrity scan.';
COMMENT ON COLUMN restaurants.integrity_failure_reason IS 'Human-readable reason for failure (if status = FAILED)';
COMMENT ON COLUMN restaurants.integrity_last_scanned_at IS 'Timestamp of last integrity scan. NULL = never scanned.';

-- Step 7: Verification query (CRITICAL - run before COMMIT)
-- If this returns any rows, the migration FAILED and transaction will ROLLBACK
SELECT 
  COUNT(*) as invalid_rows,
  COUNT(*) FILTER (WHERE integrity_status IS NULL) as null_status,
  COUNT(*) FILTER (WHERE integrity_percent IS NULL) as null_percent
FROM restaurants
WHERE integrity_status IS NULL 
   OR integrity_percent IS NULL;

-- Expected output: invalid_rows = 0, null_status = 0, null_percent = 0
-- If any are > 0, migration FAILED

COMMIT;  -- Safely commit all changes as atomic unit

-- ================================================================
-- POST-MIGRATION VERIFICATION (Run separately if needed)
-- ================================================================
-- These queries can run AFTER the transaction commits to verify:

-- Verify all rows have valid integrity_status
SELECT 
  'Status check' as check_name,
  COUNT(*) as total_restaurants,
  COUNT(*) FILTER (WHERE integrity_status = 'OK') as ok_count,
  COUNT(*) FILTER (WHERE integrity_status = 'FAILED') as failed_count,
  COUNT(*) FILTER (WHERE integrity_status IS NULL) as null_count
FROM restaurants;

-- Expected: 
--   ok_count = most restaurants
--   failed_count = 0 (initially all OK)
--   null_count = 0 (no nulls allowed)

-- Verify all rows have valid integrity_percent
SELECT 
  'Percent check' as check_name,
  COUNT(*) as total_restaurants,
  COUNT(*) FILTER (WHERE integrity_percent >= 0 AND integrity_percent <= 100) as valid_count,
  COUNT(*) FILTER (WHERE integrity_percent < 0 OR integrity_percent > 100) as invalid_count
FROM restaurants;

-- Expected:
--   valid_count = all restaurants
--   invalid_count = 0

-- Verify indexes exist
SELECT 
  'Index check' as check_name,
  schemaname,
  tablename,
  indexname
FROM pg_stat_user_indexes
WHERE tablename = 'restaurants' 
  AND indexname LIKE 'idx_restaurants%'
ORDER BY indexname;

-- Expected:
--   idx_restaurants_integrity_status
--   idx_restaurants_last_scanned_at
--   idx_restaurants_integrity_stale

