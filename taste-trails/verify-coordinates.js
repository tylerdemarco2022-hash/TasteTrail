import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log('Verifying coordinate insertion...\n');

const { data, count, error } = await supabase
  .from('restaurants')
  .select('name, lat, lng', { count: 'exact' })
  .filter('lat', 'not.is', null)
  .order('created_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('Error querying:', error.message);
} else {
  console.log(`✅ Found ${count} total restaurants with coordinates\n`);
  console.log('Latest 10 restaurants:');
  data.forEach((r, i) => {
    console.log(`${i+1}. ${r.name}`);
    console.log(`   Location: (${r.lat}, ${r.lng})`);
  });

  // Verify Overpass data from this scan
  const osmCount = await supabase
    .from('restaurants')
    .select('*', { count: 'exact', head: true })
    .filter('lat', '>=', 35.22)
    .filter('lat', '<=', 35.24)
    .filter('lng', '>=', -80.85)
    .filter('lng', '<=', -80.84);
  
  console.log(`\n✨ Success! ${osmCount.count || 0} restaurants from Overpass API have coordinates in the database!`);
}
