import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log('═══════════════════════════════════════════════════════════');
console.log('           FINAL VERIFICATION REPORT');
console.log('═══════════════════════════════════════════════════════════\n');

// Get all restaurants
const { data: restaurants, count } = await supabase
  .from('restaurants')
  .select('*', { count: 'exact' });

console.log(`✅ Total restaurants in database: ${count}\n`);

// Check data quality
let withCoordinates = 0;
let withNullCoordinates = 0;
let withCuisine = 0;
let withWebsite = 0;
let withAddress = 0;

const coordinateRanges = {
  minLat: Infinity,
  maxLat: -Infinity,
  minLng: Infinity,
  maxLng: -Infinity
};

for (const r of restaurants || []) {
  if (r.lat && r.lng) {
    withCoordinates++;
    coordinateRanges.minLat = Math.min(coordinateRanges.minLat, r.lat);
    coordinateRanges.maxLat = Math.max(coordinateRanges.maxLat, r.lat);
    coordinateRanges.minLng = Math.min(coordinateRanges.minLng, r.lng);
    coordinateRanges.maxLng = Math.max(coordinateRanges.maxLng, r.lng);
  } else {
    withNullCoordinates++;
  }
  
  if (r.cuisine) withCuisine++;
  if (r.website) withWebsite++;
  if (r.address) withAddress++;
}

console.log('DATA QUALITY METRICS:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`   Valid coordinates: ${withCoordinates}/${count} (${Math.round(withCoordinates/count*100)}%)`);
console.log(`   NULL coordinates:  ${withNullCoordinates}/${count}`);
console.log(`   With cuisine info: ${withCuisine}/${count} (${Math.round(withCuisine/count*100)}%)`);
console.log(`   With website:      ${withWebsite}/${count} (${Math.round(withWebsite/count*100)}%)`);
console.log(`   With address:      ${withAddress}/${count} (${Math.round(withAddress/count*100)}%)`);

if (withCoordinates > 0) {
  console.log('\nGEOGRAPHIC COVERAGE:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Latitude range:  ${coordinateRanges.minLat.toFixed(4)} to ${coordinateRanges.maxLat.toFixed(4)}`);
  console.log(`   Longitude range: ${coordinateRanges.minLng.toFixed(4)} to ${coordinateRanges.maxLng.toFixed(4)}`);
  
  const latSpan = coordinateRanges.maxLat - coordinateRanges.minLat;
  const lngSpan = coordinateRanges.maxLng - coordinateRanges.minLng;
  const approxMiles = Math.sqrt(latSpan * latSpan + lngSpan * lngSpan) * 69; // 1 degree ≈ 69 miles
  console.log(`   Coverage area:   ~${approxMiles.toFixed(1)} miles radius`);
}

// Show sample restaurants
console.log('\nSAMPLE RESTAURANTS:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const sample = restaurants.slice(0, 10);
sample.forEach((r, i) => {
  const coords = r.lat && r.lng ? `(${r.lat.toFixed(4)}, ${r.lng.toFixed(4)})` : '(no coords)';
  const cuisine = r.cuisine ? ` • ${r.cuisine}` : '';
  console.log(`   ${i + 1}. ${r.name} ${coords}${cuisine}`);
});

// Check for duplicates (should be 0 after cleanup)
const locationMap = new Map();
let duplicates = 0;
for (const r of restaurants || []) {
  const key = `${r.name}|${r.lat}|${r.lng}`;
  if (locationMap.has(key)) duplicates++;
  else locationMap.set(key, true);
}

console.log('\nDUPLICATE CHECK:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`   Duplicate entries: ${duplicates}`);

// Final status
console.log('\n═══════════════════════════════════════════════════════════');
if (withNullCoordinates === 0 && duplicates === 0) {
  console.log('✅ STATUS: DATABASE IS CLEAN AND READY FOR PRODUCTION');
} else {
  console.log('⚠️  STATUS: ISSUES DETECTED - ADDITIONAL CLEANUP NEEDED');
}
console.log('═══════════════════════════════════════════════════════════\n');
