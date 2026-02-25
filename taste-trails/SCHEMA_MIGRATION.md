# Discovery Schema Migration Instructions

## Problem
The `restaurants` table is missing columns required by the discovery ingestion system:
- source (OSM source identifier)
- source_id (OSM element ID) 
- phone
- amenity
- opening_hours
- updated_at

## Solution
Run the following SQL commands in your Supabase SQL Editor.

### Quick Steps
1. Open: https://app.supabase.com/project/YOUR_PROJECT/sql/new
2. Copy the SQL below
3. Click "Run"
4. Return to terminal and re-test

### SQL Migration Commands

```sql
-- Add missing columns to restaurants table
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'osm';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS source_id TEXT NOT NULL DEFAULT '';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT NULL;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS amenity TEXT DEFAULT 'restaurant';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours TEXT DEFAULT NULL;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add unique constraint for discovery duplicate detection
ALTER TABLE restaurants ADD CONSTRAINT restaurants_source_source_id_unique UNIQUE(source, source_id);
```

### What This Does
1. **source TEXT** - Stores where the restaurant came from (e.g., "osm" for OpenStreetMap)
2. **source_id TEXT** - Stores the original OSM node/way/relation ID
3. **phone TEXT** - Stores restaurant phone number  
4. **amenity TEXT** - Stores amenity type (restaurant, cafe, etc.)
5. **opening_hours TEXT** - Stores opening hours from OSM data
6. **updated_at TIMESTAMP** - Tracks when records were last modified
7. **UNIQUE(source, source_id)** - Prevents duplicate imports of same restaurant

## Testing After Migration

Once you've run the SQL, the discovery system can properly:
- Extract and store coordinates from OpenStreetMap
- Identify restaurant sources and prevent duplicates
- Insert complete restaurant records with all metadata

## Verification

Run this query to verify migration succeeded:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'restaurants'
ORDER BY ordinal_position;
```

You should see these columns:
- id, name, lat, lng (existing)
- source, source_id, phone, amenity, opening_hours, created_at, updated_at (new)

## Network Issue

Note: The automated migration script encountered a network error when trying to reach Supabase API. This is likely a temporary connectivity issue. You can either:
1. Run the SQL manually using steps above
2. Try the automated fix-schema endpoint again to get instructions:
   ```bash
   curl -X POST http://localhost:8081/admin/discovery/fix-schema \
     -H "x-admin-token: dev-secret-123" \
     -H "Content-Type: application/json"
   ```
