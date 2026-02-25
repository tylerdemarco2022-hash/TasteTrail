import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Get current columns by attempting inserts with different field combinations
// We know: name, lat, lng work
// We need to add: source, source_id, cuisine, phone, website, address, confidence, amenity, opening_hours

console.log('Migrating restaurants table schema...\n');

// Step 1: Check if columns exist by trying to insert
async function columnExists(columnName) {
  const testObj = { name: 'test', [columnName]: 'value' };
  const { error } = await supabase.from('restaurants').insert([testObj]);
  return !error || !error.message.includes(`Could not find the '${columnName}'`);
}

// Step 2: Add missing columns via RPC or raw SQL
// Since we can't use RPC functions that don't exist, we'll use the Postgrest admin API

console.log('Attempting to add missing columns to restaurants table...\n');

const columnsNeeded = [
  { name: 'source', type: 'TEXT', constraint: 'NOT NULL', default: "'osm'" },
  { name: 'source_id', type: 'TEXT', constraint: 'NOT NULL', default: "'unknown'" },
  { name: 'cuisine', type: 'TEXT', constraint: '', default: 'NULL' },
  { name: 'phone', type: 'TEXT', constraint: '', default: 'NULL' },
  { name: 'website', type: 'TEXT', constraint: '', default: 'NULL' },
  { name: 'address', type: 'TEXT', constraint: '', default: 'NULL' },
  { name: 'confidence', type: 'INTEGER', constraint: '', default: '0' },
  { name: 'amenity', type: 'TEXT', constraint: '', default: "'restaurant'" },
  { name: 'opening_hours', type: 'TEXT', constraint: '', default: 'NULL' },
  { name: 'created_at', type: 'TIMESTAMP', constraint: '', default: 'NOW()' },
  { name: 'updated_at', type: 'TIMESTAMP', constraint: '', default: 'NOW()' }
];

// Test which columns exist and need to be added
const missingColumns = [];
for (const col of columnsNeeded) {
  const exists = await columnExists(col.name);
  if (!exists) {
    console.log(`  ✓ ${col.name} needs to be added`);
    missingColumns.push(col);
  } else {
    console.log(`  ✓ ${col.name} already exists`);
  }
}

if (missingColumns.length === 0) {
  console.log('\n✨ All columns already exist!');
} else {
  console.log(`\n⚠️  ${missingColumns.length} columns need to be added`);
  console.log('\nTo fix this, run the following SQL in Supabase SQL Editor:');
  console.log('\n```sql');
  for (const col of missingColumns) {
    console.log(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} ${col.constraint} DEFAULT ${col.default};`);
  }
  console.log('```');
}
