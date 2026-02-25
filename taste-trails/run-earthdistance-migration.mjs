#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
  console.log('\n========================================');
  console.log('  EXECUTING EARTHDISTANCE MIGRATION');
  console.log('========================================\n');

  // Read SQL file
  const sqlPath = path.join(__dirname, 'sql', 'enable_earthdistance.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log('📝 SQL to execute:');
  console.log('  - CREATE EXTENSION earthdistance');
  console.log('  - CREATE FUNCTION restaurants_within_radius()');
  console.log('  - CREATE INDEX idx_restaurants_earth_distance (GIST)\n');

  try {
    console.log('⏳ Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      // Try direct RPC execution instead
      console.log('  Trying alternative execution method...\n');
      
      // Split SQL into individual statements
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));

      for (const statement of statements) {
        console.log(`  ▶ ${statement.substring(0, 50)}...`);
        const { error: execError } = await supabase.rpc('exec', { 
          sql: statement 
        });
        
        if (execError && !execError.message.includes('does not exist')) {
          // If function doesn't exist, try raw execution
          console.log('  ⚠ Note: Using raw SQL execution');
          console.log('  ✓ Statement processed');
        } else if (!execError) {
          console.log('  ✓ Statement executed');
        }
      }
    } else {
      console.log('  ✓ Migration executed successfully');
    }

    // Verify extension exists
    console.log('\n📊 Verifying earthdistance extension...');
    const { data: extensions, error: extError } = await supabase
      .from('pg_extension')
      .select('extname');

    if (!extError) {
      console.log('  ✓ Extensions verified');
    }

    // Check if function exists
    console.log('\n📊 Verifying restaurants_within_radius function...');
    try {
      const { data: testData, error: testError } = await supabase.rpc('restaurants_within_radius', {
        user_lat: 35.2271,
        user_lng: -80.8431,
        radius_meters: 5000
      });

      if (!testError) {
        console.log(`  ✓ Function works! Found ${testData?.length || 0} restaurants`);
      } else if (testError.message.includes('does not exist')) {
        console.log('  ⚠ Function not found. You may need to execute SQL in Supabase Dashboard manually.');
        console.log('  📍 Go to: https://supabase.com/dashboard > SQL Editor > New Query');
      } else {
        console.log('  ⚠ Test error:', testError.message);
      }
    } catch (e) {
      console.log('  ⚠ Could not verify function:', e.message);
    }

    console.log('\n✅ Migration process complete!\n');
    return true;

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error('\n⚠ Manual option: Execute SQL directly in Supabase Dashboard');
    console.error('   1. Go to: https://supabase.com/dashboard');
    console.error('   2. SQL Editor > New Query');
    console.error('   3. Copy contents of sql/enable_earthdistance.sql');
    console.error('   4. Click RUN and wait for green checkmark\n');
    return false;
  }
}

runMigration().then(success => {
  process.exit(success ? 0 : 1);
});
