import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function addMissingColumns() {
  console.log('Step 2: Adding missing columns to restaurants table...\n');

  // Using SQL to add columns if they don't exist
  const sql = `
    ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS cover_photo_url TEXT DEFAULT NULL;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error && error.message.includes('does not exist')) {
    console.log('RPC function not available. Using direct approach instead...');
    console.log('Note: Adding column via RPC - if this fails, run SQL in Supabase console directly.');
    
    // Try via direct insert/update to trigger column creation (won't work, but let's note it)
    console.log('Manual SQL required - run in Supabase SQL editor:');
    console.log(sql);
  } else if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Successfully added missing columns');
    console.log('Response:', data);
  }

  // Verify columns now exist
  console.log('\nVerifying columns...');
  const { data: verify, error: verifyErr } = await supabase
    .from('restaurants')
    .select('id, name, lat, lng, confidence, scan_count, user_confirmations, cover_photo_url, flagged_closed')
    .limit(1);

  if (verifyErr) {
    console.log('ERROR - Column still missing:', verifyErr.message);
  } else {
    console.log('SUCCESS - All columns accessible');
    if (verify && verify.length > 0) {
      console.log('Sample row:', JSON.stringify(verify[0], null, 2));
    }
  }
}

addMissingColumns().catch(console.error);
