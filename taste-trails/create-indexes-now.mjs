// ========================================
// CREATE DISCOVERY PERFORMANCE INDEXES
// Directly executes SQL to create indexes
// ========================================

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🚀 Creating Discovery Performance Indexes...\n');

const indexes = [
  {
    name: 'idx_restaurants_lat',
    sql: 'CREATE INDEX IF NOT EXISTS idx_restaurants_lat ON restaurants(lat);',
    description: 'Index on latitude for bounding box queries'
  },
  {
    name: 'idx_restaurants_lng',
    sql: 'CREATE INDEX IF NOT EXISTS idx_restaurants_lng ON restaurants(lng);',
    description: 'Index on longitude for bounding box queries'
  },
  {
    name: 'idx_restaurants_flagged_closed',
    sql: 'CREATE INDEX IF NOT EXISTS idx_restaurants_flagged_closed ON restaurants(flagged_closed) WHERE flagged_closed = false;',
    description: 'Partial index for active restaurants only'
  },
  {
    name: 'idx_restaurant_activity_lookup',
    sql: 'CREATE INDEX IF NOT EXISTS idx_restaurant_activity_lookup ON restaurant_activity(restaurant_id, created_at DESC, type);',
    description: 'Composite index for trending queries'
  }
];

// Try direct SQL execution via Supabase REST API
async function executeSQL(sql) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
    },
    body: JSON.stringify({ query: sql })
  });
  
  return response;
}

console.log('Attempting to create indexes via API...\n');

let successCount = 0;
let failCount = 0;

for (const index of indexes) {
  try {
    console.log(`Creating ${index.name}...`);
    console.log(`  ${index.description}`);
    
    const response = await executeSQL(index.sql);
    
    if (response.ok) {
      console.log(`  ✅ Created successfully\n`);
      successCount++;
    } else {
      const error = await response.text();
      console.log(`  ⚠️  API method not available`);
      console.log(`  Will need manual SQL execution\n`);
      failCount++;
    }
  } catch (err) {
    console.log(`  ⚠️  Cannot create via API: ${err.message}\n`);
    failCount++;
  }
}

if (failCount > 0) {
  console.log('\n========================================');
  console.log('⚠️  MANUAL SQL EXECUTION REQUIRED');
  console.log('========================================\n');
  console.log('Go to: https://supabase.com/dashboard');
  console.log('Navigate to: SQL Editor → New Query\n');
  console.log('Paste and run this SQL:\n');
  console.log('---');
  indexes.forEach(index => {
    console.log(index.sql);
  });
  console.log('---\n');
  console.log('Then retest with: node test-performance.mjs\n');
} else {
  console.log('\n========================================');
  console.log('✅ ALL INDEXES CREATED SUCCESSFULLY');
  console.log('========================================\n');
  console.log('Retest performance: node test-performance.mjs\n');
}

console.log(`Summary: ${successCount} created, ${failCount} require manual action`);
