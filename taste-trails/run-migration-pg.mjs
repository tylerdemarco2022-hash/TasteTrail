#!/usr/bin/env node

import pkg from 'pg';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pkg;
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse Supabase connection string
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Extract host from URL (e.g., https://xxxxx.supabase.co -> xxxxx.supabase.co)
const urlObj = new URL(SUPABASE_URL);
const host = urlObj.hostname;

// Connection string format: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
const connectionString = `postgresql://postgres:${SUPABASE_SERVICE_ROLE_KEY}@${host}:5432/postgres`;

async function runMigration() {
  const client = new Client({ connectionString });

  try {
    console.log('\n========================================');
    console.log('  EXECUTING EARTHDISTANCE MIGRATION');
    console.log('========================================\n');

    console.log('🔌 Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✓ Connected!\n');

    // Read SQL file
    const sqlPath = path.join(__dirname, 'sql', 'enable_earthdistance.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('📝 Executing SQL statements:');
    console.log('  1. CREATE EXTENSION earthdistance');
    console.log('  2. CREATE FUNCTION restaurants_within_radius()');
    console.log('  3. CREATE INDEX idx_restaurants_earth_distance\n');

    // Execute full SQL
    await client.query(sql);
    console.log('✓ All statements executed successfully!\n');

    // Verify function exists and works
    console.log('📊 Verifying function...');
    const result = await client.query(
      `SELECT COUNT(*) as count FROM restaurants_within_radius(35.2271, -80.8431, 5000)`
    );
    console.log(`✓ Function test successful! Found ${result.rows[0].count} restaurants\n`);

    console.log('✅ Migration complete!\n');
    return true;

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
      console.error('\n⚠ Could not connect to PostgreSQL');
      console.error('   This may indicate your Supabase connection string is invalid');
      console.error('   Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env\n');
    }
    return false;

  } finally {
    await client.end();
  }
}

runMigration().then(success => {
  process.exit(success ? 0 : 1);
});
