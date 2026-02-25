// ========================================
// AUTOMATED INDEX CREATION FOR DISCOVERY
// Run this to add performance indexes
// ========================================

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 Creating performance indexes for discovery...\n');

const indexStatements = [
  {
    name: 'idx_restaurants_lat',
    sql: 'CREATE INDEX IF NOT EXISTS idx_restaurants_lat ON restaurants(lat);'
  },
  {
    name: 'idx_restaurants_lng',
    sql: 'CREATE INDEX IF NOT EXISTS idx_restaurants_lng ON restaurants(lng);'
  },
  {
    name: 'idx_restaurants_flagged_closed',
    sql: 'CREATE INDEX IF NOT EXISTS idx_restaurants_flagged_closed ON restaurants(flagged_closed) WHERE flagged_closed = false;'
  },
  {
    name: 'idx_restaurant_activity_lookup',
    sql: 'CREATE INDEX IF NOT EXISTS idx_restaurant_activity_lookup ON restaurant_activity(restaurant_id, created_at DESC, type);'
  }
];

async function createIndexes() {
  for (const index of indexStatements) {
    try {
      console.log(`Creating ${index.name}...`);
      
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: index.sql });
      
      if (error) {
        // If RPC doesn't exist, log SQL to run manually
        console.log(`⚠️  Cannot create via API. Run this SQL in Supabase Dashboard:`);
        console.log(`   ${index.sql}\n`);
      } else {
        console.log(`✅ ${index.name} created\n`);
      }
    } catch (err) {
      console.log(`⚠️  Error for ${index.name}:`);
      console.log(`   Run this SQL manually in Supabase Dashboard:`);
      console.log(`   ${index.sql}\n`);
    }
  }
  
  console.log('\n========================================');
  console.log('MANUAL STEP REQUIRED:');
  console.log('========================================');
  console.log('Go to Supabase Dashboard → SQL Editor');
  console.log('Paste the contents of:');
  console.log('  sql/add_discovery_indexes.sql');
  console.log('Click RUN');
  console.log('========================================\n');
}

createIndexes().catch(console.error);
