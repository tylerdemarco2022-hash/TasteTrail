// Direct Supabase connection test
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

console.log('🔧 Testing Supabase Connection...\n');
console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL}`);
console.log(`Service Role Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Loaded' : '❌ Missing'}\n`);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Testing simple query...');

try {
  const { data, error, count } = await supabase
    .from('restaurants')
    .select('id, name, lat, lng', { count: 'exact' })
    .limit(5);
  
  if (error) {
    console.log('❌ Query error:', error.message);
    console.log('Full error:', error);
  } else {
    console.log(`✅ Query successful!`);
    console.log(`   - Total restaurants: ${count}`);
    console.log(`   - Sample (first 5):`, data.map(r => r.name));
    console.log(`   - All have coordinates: ${data.every(r => r.lat && r.lng) ? 'YES' : 'NO'}`);
  }
} catch (err) {
  console.log('❌ Connection error:', err.message);
  console.log('Full error:', err);
}
