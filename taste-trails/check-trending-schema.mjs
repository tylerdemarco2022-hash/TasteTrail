import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log('🔍 Checking restaurants table schema...\n');

const { data: allRest, error } = await supabase
  .from('restaurants')
  .select('id, name, views_7d, confirms_30d, trending_score')
  .limit(5);

if (error) {
  console.log('❌ Error:', error.message);
  process.exit(1);
}

console.log('Sample data (first 5 restaurants):');
allRest.forEach(r => {
  console.log(`  ID: ${r.id}, Views: ${r.views_7d}, Confirms: ${r.confirms_30d}, Score: ${r.trending_score}`);
});

// Check if columns have any non-null values
const { data: withViews, count: viewCount } = await supabase
  .from('restaurants')
  .select('id', { count: 'exact' })
  .gt('views_7d', 0);

console.log(`\nRestaurants with views_7d > 0: ${viewCount || 0}`);

// Check total count
const { count: totalCount } = await supabase
  .from('restaurants')
  .select('*', { count: 'exact', head: true });

console.log(`Total restaurants: ${totalCount}`);
