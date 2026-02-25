#!/usr/bin/env node
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config();

const sqlCommands = [
  `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'osm'`,
  `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS source_id TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT NULL`,
  `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS amenity TEXT DEFAULT 'restaurant'`,
  `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours TEXT DEFAULT NULL`,
  `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
  `ALTER TABLE restaurants ADD UNIQUE(source, source_id)`
];

console.log('Taste Trails Restaurant Schema Migration');
console.log('========================================\n');

// Check if we have the necessary environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const SUPABASE_PROJECT_ID = process.env.SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1];
if (!SUPABASE_PROJECT_ID) {
  console.error('❌ Could not extract project ID from SUPABASE_URL');
  process.exit(1);
}

console.log('Supabase Project:', SUPABASE_PROJECT_ID);
console.log('\n' + '='.repeat(50));
console.log('Please run the following SQL in Supabase SQL Editor:');
console.log('https://app.supabase.com/project/' + SUPABASE_PROJECT_ID + '/sql/new');
console.log('='.repeat(50) + '\n');

console.log('```sql');
sqlCommands.forEach(cmd => console.log(cmd + ';'));
console.log('```\n');

console.log('Steps:');
console.log('1. Copy the SQL commands above');
console.log('2. Open your Supabase project SQL Editor');
console.log('3. Paste and execute');
console.log('4. Return and test the discovery pipeline\n');

// Try to create a migration function that can be called later
const migrationFunction = `
CREATE OR REPLACE FUNCTION fix_restaurants_schema()
RETURNS TABLE(status text, message text) AS $$
BEGIN
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'osm';
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS source_id TEXT NOT NULL DEFAULT '';
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT NULL;
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS amenity TEXT DEFAULT 'restaurant';
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours TEXT DEFAULT NULL;
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  RETURN QUERY SELECT 'success'::text, 'Schema migration completed'::text;
END;
$$ LANGUAGE plpgsql;
`;

console.log('Alternative: Create a migration function (also paste in SQL Editor):');
console.log('\n```sql');
console.log(migrationFunction);
console.log('```\n');

console.log('Then call it with: SELECT fix_restaurants_schema();');
