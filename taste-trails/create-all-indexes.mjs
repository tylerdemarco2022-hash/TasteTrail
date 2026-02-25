import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log('🔨 Creating database indexes...\n');

const indexes = [
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
    sql: 'CREATE INDEX IF NOT EXISTS idx_restaurants_flagged_closed ON restaurants(flagged_closed);'
  },
  {
    name: 'idx_restaurants_trending_score',
    sql: 'CREATE INDEX IF NOT EXISTS idx_restaurants_trending_score ON restaurants(trending_score DESC);'
  },
  {
    name: 'idx_restaurants_views_7d',
    sql: 'CREATE INDEX IF NOT EXISTS idx_restaurants_views_7d ON restaurants(views_7d DESC);'
  },
  {
    name: 'idx_restaurants_confirms_30d',
    sql: 'CREATE INDEX IF NOT EXISTS idx_restaurants_confirms_30d ON restaurants(confirms_30d DESC);'
  }
];

for (const idx of indexes) {
  try {
    const { error } = await supabase.rpc('exec', { sql: idx.sql }).catch(err => ({ error: err }));
    
    if (error) {
      console.log(`⚠️  ${idx.name}: RPC method not available`);
    } else {
      console.log(`✅ ${idx.name}`);
    }
  } catch (err) {
    console.log(`⚠️  ${idx.name}: ${err.message}`);
  }
}

console.log('\n📝 To manually create indexes:');
console.log('1. Go to Supabase Dashboard');
console.log('2. SQL Editor → New Query');
console.log('3. Paste this SQL:\n');

console.log(indexes.map(i => i.sql).join('\n'));

console.log('\n4. Click RUN');
