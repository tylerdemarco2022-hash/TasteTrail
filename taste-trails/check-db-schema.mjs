import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function checkSchema() {
  console.log('📋 Checking database schema...\n');
  
  // Check what tables exist by trying to query them
  const tables = ['dish_ratings', 'ratings', 'menu_items', 'restaurants'];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`❌ Table '${table}': Does not exist or error - ${error.message}`);
    } else {
      console.log(`✅ Table '${table}': Exists (${data?.length || 0} sample records)`);
      if (data && data.length > 0) {
        console.log('   Columns:', Object.keys(data[0]).join(', '));
      }
    }
  }
  
  // Check if menu_items has any records
  console.log('\n📊 Menu Items Count:');
  const { data: items, error: itemsErr } = await supabase
    .from('menu_items')
    .select('id, name, restaurant_id');
  
  if (!itemsErr && items) {
    console.log(`   Total menu items: ${items.length}`);
    if (items.length > 0) {
      console.log('   First 5:', items.slice(0, 5));
    }
  }
}

checkSchema().catch(console.error);
