import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Try with minimal fields - just name and id
console.log('Testing different insert scenarios...\n');

// Test 1: Minimal insert
console.log('Test 1: Insert with just name');
const { error: e1 } = await supabase.from('restaurants').insert([{ name: 'Test' }]);
if (e1) console.log('  Error:', e1.message);
else console.log('  Success');

// Test 2: With coordinates
console.log('\nTest 2: Insert with name and lat/lng');
const { error: e2 } = await supabase.from('restaurants').insert([{ name: 'Test', lat: 35.2, lng: -80.8 }]);
if (e2) console.log('  Error:', e2.message);
else console.log('  Success');

// Test 3: With source and source_id
console.log('\nTest 3: Insert with source and source_id');
const { error: e3 } = await supabase.from('restaurants').insert([{ 
  name: 'Test', 
  lat: 35.2, 
  lng: -80.8,
  source: 'osm',
  source_id: '12345'
}]);
if (e3) console.log('  Error:', e3.message);
else console.log('  Success');

// Test 4: With all fields from parseElements
console.log('\nTest 4: Insert with all parseElements fields');
const { error: e4 } = await supabase.from('restaurants').insert([{ 
  source: 'osm',
  source_id: '123456',
  name: 'Test Restaurant',
  lat: 35.2271,
  lng: -80.8431,
  cuisine: 'italian',
  phone: null,
  website: null,
  address: null,
  amenity: 'restaurant',
  opening_hours: null
}]);
if (e4) console.log('  Error:', e4.message);
else console.log('  Success');
