import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log('========================');
console.log('STEP 1: Recent Restaurant Coordinates');
console.log('========================\n');

const { data: restaurants, error } = await supabase
  .from('restaurants')
  .select('name, lat, lng, created_at, scan_count')
  .order('created_at', { ascending: false })
  .limit(20);

if (error) {
  console.log('ERROR:', error.message);
} else {
  console.log('Recent 20 restaurants:\n');
  restaurants.forEach((r, i) => {
    const latStatus = (r.lat === null) ? 'NULL' : (r.lat === 0) ? 'ZERO' : 'OK';
    const lngStatus = (r.lng === null) ? 'NULL' : (r.lng === 0) ? 'ZERO' : 'OK';
    console.log(`${i+1}. ${r.name}`);
    console.log(`   Lat: ${r.lat} (${latStatus}), Lng: ${r.lng} (${lngStatus})`);
    console.log(`   Scan Count: ${r.scan_count}, Created: ${new Date(r.created_at).toLocaleDateString()}`);
  });
}

console.log('\n========================');
console.log('STEP 2: Charlotte Bounds Check');
console.log('========================\n');

const { count, error: countError } = await supabase
  .from('restaurants')
  .select('*', { count: 'exact', head: true })
  .gte('lat', 35.0)
  .lte('lat', 35.4)
  .gte('lng', -81.0)
  .lte('lng', -80.6);

console.log('Charlotte Bounds (Lat: 35.0-35.4, Lng: -81.0 to -80.6)');
console.log('Restaurants in bounds: ' + (count || 0));
console.log('Status: ' + (count > 0 ? 'OK' : 'Warning - No data'));

console.log('\n========================');
console.log('STEP 4: Scan Data Insertion Check');
console.log('========================\n');

const { count: scanCount, error: scanError } = await supabase
  .from('restaurants')
  .select('*', { count: 'exact', head: true })
  .gt('scan_count', 1);

console.log('Restaurants with scan_count > 1: ' + (scanCount || 0));
console.log('Status: ' + (scanCount > 0 ? 'OK - Scan inserted data' : 'Fail - No scan data found'));

// Also get total restaurant count
const { count: totalCount } = await supabase
  .from('restaurants')
  .select('*', { count: 'exact', head: true });

console.log('\nTotal restaurants in database: ' + (totalCount || 0));
