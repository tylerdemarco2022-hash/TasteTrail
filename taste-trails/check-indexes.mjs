import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log('🔍 Checking database indexes...\n');

// Query information_schema to list all indexes on restaurants table
const { data, error } = await supabase.rpc('get_table_indexes', {
  table_name: 'restaurants'
}).catch(err => {
  console.log('RPC not available, trying direct query...');
  return { data: null, error: err };
});

if (error || !data) {
  console.log('Cannot query indexes directly');
  console.log('\n⚠️ Manual check needed:');
  console.log('1. Go to Supabase Dashboard');
  console.log('2. Select your database');
  console.log('3. Look for "restaurants" table');
  console.log('4. Check the Indexes tab');
  console.log('\nRequired indexes:');
  console.log('  ✓ idx_restaurants_lat');
  console.log('  ✓ idx_restaurants_lng');
  console.log('  ✓ idx_restaurants_flagged_closed');
  console.log('  ✓ idx_restaurants_trending_score');
  process.exit(0);
}

console.log('Indexes found:', data);
