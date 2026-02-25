import decode from 'jwt-decode';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Use Supabase SQL API endpoint
async function executeSql(sql) {
  const url = `${SUPABASE_URL}/rest/v1/`;
  
  // Actually, we need to use the Supabase postgREST functions
  // But for table schema changes, we need a different approach
  // Let's use the admin API with the service role key
  
  console.log('Supabase URL:', SUPABASE_URL);
  console.log('Executing migrations...\n');
  
  const migrations = [
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'osm'`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS source_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT NULL`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS amenity TEXT DEFAULT 'restaurant'`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours TEXT DEFAULT NULL`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`
  ];

  // Since we're using postgREST which doesn't support DDL, we need to use the SQL API
  // The Supabase SQL endpoint is: <SUPABASE_URL>/rest/v1/rpc
  // But for raw SQL execution, we need a different endpoint
  
  // Actually, Supabase doesn't expose a raw SQL endpoint via postgREST
  // We would need to create a Postgres function or use the dashboard
  
  console.log('⚠️  Cannot execute SQL migrations directly from Node.js via Supabase postgREST API');
  console.log('\nPlease run the following SQL in your Supabase SQL Editor:');
  console.log('https://app.supabase.com/project/_/sql/new\n');
  
  console.log('```sql');
  migrations.forEach(sql => console.log(sql + ';'));
  console.log('```\n');
  
  console.log('After running the SQL:');
  console.log('1. The restaurants table will have all required columns');
  console.log('2. The discovery ingestion will be able to insert records with coordinates');
  console.log('3. The API will be able to query restaurants by location');
}

executeSql('').catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
