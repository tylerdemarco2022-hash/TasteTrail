import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function checkSchema() {
  console.log('🔍 Checking ratings table schema...\n');
  
  // Get a sample row to see column types
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .limit(1);
  
  console.log('Sample row:', data);
  console.log('Error:', error);
  
  // Try to describe the table structure
  console.log('\n📋 To check column types, run this in Supabase SQL Editor:\n');
  console.log(`SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'ratings' 
  AND table_schema = 'public'
ORDER BY ordinal_position;`);
}

checkSchema().catch(console.error);
