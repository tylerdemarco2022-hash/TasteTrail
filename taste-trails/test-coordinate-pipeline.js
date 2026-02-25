import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { parseElements } from './backend/discovery/overpassClient.js';
import { computeConfidence } from './backend/discovery/confidence.js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Simulate Overpass API response with various coordinate formats
const mockElements = [
  {
    id: 123456,
    tags: { name: 'Test Restaurant 1', cuisine: 'italian' },
    lat: 35.2271,
    lon: -80.8431
  },
  {
    id: 123457,
    tags: { name: 'Test Restaurant 2', cuisine: 'mexican' },
    // Using center object format (alternative Overpass format)
    center: { lat: 35.2300, lon: -80.8400 }
  },
  {
    id: 123458,
    tags: { name: 'No Coordinates Restaurant' },
    // This should be filtered out
  }
];

console.log('=== Testing Coordinate Extraction Pipeline ===\n');

// Test parseElements function
console.log('1. Testing parseElements()...');
const parsed = parseElements(mockElements);
console.log(`   Parsed ${parsed.length} restaurants (should be 2):`);
parsed.forEach((r, i) => {
  console.log(`   [${i}] ${r.name}: (${r.lat}, ${r.lng})`);
});

// Test upsert with coordinates
console.log('\n2. Testing upsert with coordinates...');
for (const restaurant of parsed) {
  const withConfidence = {
    ...restaurant,
    confidence: computeConfidence(restaurant)
  };

  const { data, error } = await supabase
    .from('restaurants')
    .upsert(withConfidence, { onConflict: 'source,source_id' })
    .select();

  if (error) {
    console.log(`   ❌ Error upserting ${restaurant.name}: ${error.message}`);
  } else {
    console.log(`   ✅ Upserted ${restaurant.name} with coords (${restaurant.lat}, ${restaurant.lng})`);
  }
}

// Verify data was inserted with coordinates
console.log('\n3. Verifying inserted data...');
const { data: inserted, error: selectError } = await supabase
  .from('restaurants')
  .select('name, lat, lng, source, source_id')
  .order('created_at', { ascending: false })
  .limit(5);

if (selectError) {
  console.log('   ❌ Error reading data:', selectError.message);
} else if (inserted && inserted.length > 0) {
  console.log(`   ${inserted.length} records in database:`);
  inserted.forEach(r => {
    const coordStatus = r.lat && r.lng ? '✅' : '❌';
    console.log(`   ${coordStatus} ${r.name}: (${r.lat}, ${r.lng}) [${r.source}:${r.source_id}]`);
  });

  // Check for NULL coordinates
  const nullCoords = inserted.filter(r => !r.lat || !r.lng);
  if (nullCoords.length === 0) {
    console.log('\n✨ SUCCESS: All records have valid coordinates!');
  } else {
    console.log(`\n⚠️  WARNING: ${nullCoords.length} records have NULL coordinates`);
  }
} else {
  console.log('   No records found');
}
