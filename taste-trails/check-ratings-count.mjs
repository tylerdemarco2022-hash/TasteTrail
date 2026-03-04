import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function checkRatingsCount() {
  console.log('📊 Checking ratings count...\n');
  
  // Count total ratings
  const { data: ratings, error } = await supabase
    .from('dish_ratings')
    .select('*');
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  console.log(`✅ Total ratings in database: ${ratings?.length || 0}`);
  
  if (ratings && ratings.length > 0) {
    console.log('\nRecent ratings:');
    ratings.slice(0, 10).forEach((r, i) => {
      console.log(`${i + 1}. Rating: ${r.rating}/10 - Menu Item ID: ${r.menu_item_id} - Created: ${r.created_at}`);
    });
  }
  
  // Count unique dishes
  const uniqueDishes = new Set(ratings?.map(r => r.menu_item_id) || []);
  console.log(`\n📊 Unique dishes rated: ${uniqueDishes.size}`);
  
  // Count unique users
  const uniqueUsers = new Set(ratings?.map(r => r.user_id) || []);
  console.log(`👤 Unique users who rated: ${uniqueUsers.size}`);
}

checkRatingsCount().catch(console.error);
