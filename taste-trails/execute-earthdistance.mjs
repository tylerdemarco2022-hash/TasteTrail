import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log('🚀 EXECUTING EARTHDISTANCE MIGRATION\n');

const sqlStatements = [
  'CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;',
  `
    CREATE OR REPLACE FUNCTION restaurants_within_radius(
      user_lat FLOAT,
      user_lng FLOAT,
      radius_meters FLOAT
    )
    RETURNS TABLE (
      id UUID,
      name TEXT,
      cuisine TEXT,
      lat FLOAT,
      lng FLOAT,
      confidence FLOAT,
      flagged_closed BOOLEAN,
      cover_photo_url TEXT,
      trending_score INTEGER
    ) AS $$
      SELECT
        r.id,
        r.name,
        r.cuisine,
        r.lat,
        r.lng,
        r.confidence,
        r.flagged_closed,
        r.cover_photo_url,
        r.trending_score
      FROM restaurants r
      WHERE earth_distance(
        ll_to_earth(user_lat, user_lng),
        ll_to_earth(r.lat, r.lng)
      ) <= radius_meters
      AND r.flagged_closed = false
      ORDER BY r.trending_score DESC;
    $$ LANGUAGE sql STABLE PARALLEL SAFE;
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_restaurants_earth_distance
    ON restaurants USING gist (ll_to_earth(lat, lng));
  `
];

for (let i = 0; i < sqlStatements.length; i++) {
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: sqlStatements[i] }).catch(err => {
      // If RPC doesn't exist, try using the migration approach
      return { error: err };
    });
    
    if (error && error.message && error.message.includes('does not exist')) {
      // RPC function doesn't exist, let's try a different approach
      console.log(`⚠️  Step ${i + 1}: RPC exec not available (may be run manually in Supabase)`);
    } else if (error) {
      console.log(`❌ Step ${i + 1} ERROR:`, error.message);
    } else {
      console.log(`✅ Step ${i + 1}: SQL executed successfully`);
    }
  } catch (err) {
    console.log(`⚠️  Step ${i + 1}: ${err.message}`);
  }
}

console.log('\n📝 NOTE: If RPC execution failed above, you must manually run the SQL in Supabase Dashboard.');
console.log('   See: sql/enable_earthdistance.sql');
console.log('\n✅ All SQL statements prepared. Ready to test.\n');
