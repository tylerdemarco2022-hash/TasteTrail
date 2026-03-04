import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function insertTestRatings() {
  console.log('🧪 Inserting test ratings...\n');

  // First, get or create a test restaurant
  const { data: restaurants, error: restError } = await supabase
    .from('restaurants')
    .select('id')
    .ilike('name', 'Test Restaurant')
    .limit(1);

  let restaurantId;
  if (!restaurants || restaurants.length === 0) {
    const { data: newRest, error } = await supabase
      .from('restaurants')
      .insert([{ name: 'Test Restaurant' }])
      .select();
    if (error) {
      console.error('❌ Failed to create restaurant:', error);
      return;
    }
    restaurantId = newRest[0].id;
    console.log('✅ Created test restaurant:', restaurantId);
  } else {
    restaurantId = restaurants[0].id;
    console.log('✅ Using existing test restaurant:', restaurantId);
  }

  // Create 3 test dishes
  const dishes = [
    { name: 'Burger', description: 'Classic burger' },
    { name: 'Pizza', description: 'Cheese pizza' },
    { name: 'Pasta', description: 'Spaghetti carbonara' }
  ];

  const dishIds = [];
  for (const dish of dishes) {
    const { data: newDish, error } = await supabase
      .from('dishes')
      .insert([{
        name: dish.name,
        restaurant_id: restaurantId,
        description: dish.description
      }])
      .select();

    if (error) {
      console.error(`❌ Failed to create dish ${dish.name}:`, error);
      return;
    }
    dishIds.push(newDish[0].id);
    console.log(`✅ Created dish: ${dish.name} (${newDish[0].id})`);
  }

  // Create test users (insert into users table so foreign key constraint passes)
  console.log('👤 Creating test users...\n');
  const testUserIds = [
    'df673dd1-f707-4107-9da5-777e1ac2f363',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  ];

  for (const userId of testUserIds) {
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .limit(1);

    if (!existingUser || existingUser.length === 0) {
      // Create user with minimal required fields
      const { error } = await supabase
        .from('users')
        .insert([{ id: userId }]);
      
      if (!error) {
        console.log(`✅ Created test user: ${userId}`);
      } else if (error.code === '23505') {
        console.log(`✅ User already exists: ${userId}`);
      } else {
        console.error(`⚠️ Could not create user ${userId}:`, error.message);
      }
    } else {
      console.log(`✅ User already exists: ${userId}`);
    }
  }

  const testUsers = testUserIds;

  // Insert ratings (scaled from 1-5)
  const ratings = [
    { dishIdx: 0, userIdx: 0, rating: 4.5, comment: 'Great burger!' },
    { dishIdx: 1, userIdx: 1, rating: 4.8, comment: 'Amazing pizza!' },
    { dishIdx: 2, userIdx: 2, rating: 4.2, comment: 'Good pasta' }
  ];

  console.log('\n📝 Inserting ratings...\n');

  for (const r of ratings) {
    const { data: insertedRating, error } = await supabase
      .from('ratings')
      .insert([{
        dish_id: dishIds[r.dishIdx],
        user_id: testUsers[r.userIdx],
        rating: r.rating
      }])
      .select();

    if (error) {
      console.error(`❌ Failed to insert rating:`, error);
      return;
    }
    console.log(`✅ Rating inserted: ${r.rating}/5 for ${dishes[r.dishIdx].name} by user ${r.userIdx}`);
  }

  // Verify all ratings were inserted
  console.log('\n🔍 Verifying ratings in database...\n');
  const { data: allRatings, error: verifyError } = await supabase
    .from('ratings')
    .select('id, dish_id, user_id, rating, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (verifyError) {
    console.error('❌ Verification query failed:', verifyError);
    return;
  }

  console.log(`✅ Total ratings in database: ${allRatings.length}`);
  console.log('\nRecent ratings:');
  allRatings.forEach((r, i) => {
    console.log(`  ${i+1}. Rating: ${r.rating}/5 | Created: ${new Date(r.created_at).toLocaleString()}`);
  });

  console.log('\n✨ Test data inserted successfully!');
}

insertTestRatings().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
