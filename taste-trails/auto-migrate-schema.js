import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

// Extract project ID from URL
const PROJECT_ID = SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1];

async function executeSql(sql) {
  try {
    // Try Supabase API - this endpoint might not exist
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_raw_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY
      },
      body: JSON.stringify({ sql })
    });

    const data = await response.json();
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function runMigrations() {
  console.log('Attempting to run schema migrations...\n');

  const commands = [
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'osm'`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS source_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT NULL`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS amenity TEXT DEFAULT 'restaurant'`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours TEXT DEFAULT NULL`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`
  ];

  for (const cmd of commands) {
    console.log(`Executing: ${cmd.substring(0, 60)}...`);
    const result = await executeSql(cmd);
    console.log(`  Status: ${result.status} - ${result.success ? 'OK' : 'FAILED'}`);
    if (result.error) console.log(`  Error: ${result.error}`);
  }

  console.log('\n✨ If all commands show status 200-201, migrations succeeded!');
  console.log('Otherwise, run them manually in Supabase SQL Editor');
}

runMigrations().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
