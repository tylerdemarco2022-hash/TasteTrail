import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function investigateRatings() {
  console.log('🔍 Investigating why ratings don\'t appear in API...\n');
  
  // Get the ratings
  const { data: ratings, error: ratingsError } = await supabase
    .from('dish_ratings')
    .select('*');
  
  console.log('Ratings:', JSON.stringify(ratings, null, 2));
  
  // Get menu items
  const { data: menuItems, error: menuError } = await supabase
    .from('menu_items')
    .select('*')
    .eq('id', 1);
  
  console.log('\nMenu Item ID 1:', JSON.stringify(menuItems, null, 2));
  
  // Try the same query the API uses
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffISO = cutoffDate.toISOString();
  
  console.log(`\nQuerying ratings since: ${cutoffISO}`);
  
  const { data: apiQuery, error: apiError } = await supabase
    .from('dish_ratings')
    .select(`
      rating,
      menu_item_id,
      created_at,
      menu_items!inner(
        id,
        name,
        description,
        price,
        photo_url,
        restaurant_id,
        restaurants!inner(
          id,
          name
        )
      )
    `)
    .gte('created_at', cutoffISO)
    .limit(1000);
  
  if (apiError) {
    console.error('❌ API Query Error:', apiError);
  } else {
    console.log(`✅ API Query returned ${apiQuery?.length || 0} results`);
    console.log('Results:', JSON.stringify(apiQuery, null, 2));
  }
}

investigateRatings().catch(console.error);
