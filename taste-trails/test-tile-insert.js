import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Test inserting a tile with only required fields
const testTile = {
  city: 'Charlotte Test',
  center_lat: 35.2271,
  center_lng: -80.8431,
  radius_m: 1500,
  priority: 5,
  next_run_at: new Date().toISOString()
};

console.log('Inserting test tile:', testTile);

const { data, error } = await supabase.from('discovery_tiles').insert([testTile]);
if (error) {
  console.log('ERROR:', error.message);
  console.log('Code:', error.code);
  console.log('Full error:', JSON.stringify(error, null, 2));
} else {
  console.log('SUCCESS: Inserted');
  console.log('Data:', data);
}
