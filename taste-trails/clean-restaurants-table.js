import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║     RESTAURANTS TABLE CLEANUP - POST INGESTION REPAIR     ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// ========================
// STEP 1: Remove NULL Coordinates
// ========================
console.log('STEP 1: Removing rows with NULL coordinates...');

const { error: deleteError1, count: deletedNull } = await supabase
  .from('restaurants')
  .delete()
  .or('lat.is.null,lng.is.null')
  .select('*', { count: 'exact', head: true });

if (deleteError1) {
  console.log('❌ Error removing NULL coordinates:', deleteError1.message);
} else {
  console.log(`✅ Removed rows with NULL coordinates\n`);
}

// ========================
// STEP 2: Find and Remove Exact Duplicates
// ========================
console.log('STEP 2: Finding exact duplicates (same name + lat + lng)...');

// First, find duplicates
const { data: allRestaurants, error: fetchError } = await supabase
  .from('restaurants')
  .select('id, name, lat, lng')
  .order('id');

if (fetchError) {
  console.log('❌ Error fetching restaurants:', fetchError.message);
  process.exit(1);
}

console.log(`   Analyzing ${allRestaurants.length} restaurants...`);

// Group by name + lat + lng
const locationMap = new Map();
const duplicatesToDelete = [];

for (const restaurant of allRestaurants) {
  const key = `${restaurant.name}|${restaurant.lat}|${restaurant.lng}`;
  
  if (locationMap.has(key)) {
    // This is a duplicate - mark for deletion (keep lowest ID)
    duplicatesToDelete.push(restaurant.id);
  } else {
    locationMap.set(key, restaurant.id);
  }
}

console.log(`   Found ${duplicatesToDelete.length} duplicate records to remove`);

if (duplicatesToDelete.length > 0) {
  // Delete duplicates in batches
  const batchSize = 100;
  let deletedCount = 0;
  
  for (let i = 0; i < duplicatesToDelete.length; i += batchSize) {
    const batch = duplicatesToDelete.slice(i, i + batchSize);
    const { error: deleteError } = await supabase
      .from('restaurants')
      .delete()
      .in('id', batch);
    
    if (deleteError) {
      console.log(`   ⚠️  Error deleting batch: ${deleteError.message}`);
    } else {
      deletedCount += batch.length;
      console.log(`   Deleted ${deletedCount}/${duplicatesToDelete.length} duplicates...`);
    }
  }
  
  console.log(`✅ Removed ${deletedCount} duplicate records\n`);
} else {
  console.log('✅ No duplicates found\n');
}

// ========================
// STEP 3: Add Uniqueness Constraint
// ========================
console.log('STEP 3: Adding unique constraint on (name, lat, lng)...');
console.log('   Note: Constraint must be added via SQL Editor in Supabase Dashboard');
console.log('   SQL: CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_restaurant_location');
console.log('        ON restaurants(name, lat, lng);\n');

// ========================
// STEP 4: Verify Clean State
// ========================
console.log('STEP 4: Verifying clean state...\n');

// Count total restaurants
const { count: totalCount } = await supabase
  .from('restaurants')
  .select('*', { count: 'exact', head: true });

console.log(`   Total restaurants: ${totalCount}`);

// Count NULL coordinates
const { count: nullCount } = await supabase
  .from('restaurants')
  .select('*', { count: 'exact', head: true })
  .or('lat.is.null,lng.is.null');

console.log(`   Rows with NULL coordinates: ${nullCount}`);

// Check for remaining duplicates
const { data: verifyRestaurants } = await supabase
  .from('restaurants')
  .select('name, lat, lng')
  .order('name');

const verifyMap = new Map();
let remainingDuplicates = 0;

for (const r of verifyRestaurants || []) {
  const key = `${r.name}|${r.lat}|${r.lng}`;
  if (verifyMap.has(key)) {
    remainingDuplicates++;
  } else {
    verifyMap.set(key, true);
  }
}

console.log(`   Remaining duplicates: ${remainingDuplicates}`);

// Show sample of cleaned data
console.log('\n   Sample of cleaned data:');
const { data: sampleData } = await supabase
  .from('restaurants')
  .select('name, lat, lng')
  .limit(5);

sampleData?.forEach((r, i) => {
  console.log(`   ${i + 1}. ${r.name} (${r.lat}, ${r.lng})`);
});

// ========================
// SUMMARY
// ========================
console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║                    CLEANUP SUMMARY                        ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log(`   Final restaurant count: ${totalCount}`);
console.log(`   NULL coordinate rows: ${nullCount}`);
console.log(`   Remaining duplicates: ${remainingDuplicates}`);

if (nullCount === 0 && remainingDuplicates === 0) {
  console.log('\n✨ SUCCESS: Database is clean!');
} else {
  console.log('\n⚠️  WARNING: Issues remain - may need additional cleanup');
}

console.log('\n📝 MANUAL STEP REQUIRED:');
console.log('   Run this in Supabase SQL Editor to add constraint:');
console.log('   CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_restaurant_location');
console.log('   ON restaurants(name, lat, lng);');
