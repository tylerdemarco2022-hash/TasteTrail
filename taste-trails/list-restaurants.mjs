import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://szplopxrhawfwveiycru.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpdmV1anVnZ3Vma3BkbGVubnVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MjIyOTEsImV4cCI6MjA4MzI5ODI5MX0.ojRm53EF3z6hGjqKF6tEJaG2rPqtIvIfMUqTMQzAqIU'
);

async function listRestaurants() {
  try {
    const { data: rests } = await supabase
      .from('restaurants')
      .select('id, name')
      .order('name');
    
    console.log('📍 All restaurants in database:');
    rests?.forEach(r => {
      console.log(`  - ${r.name} (ID: ${r.id})`);
    });
    
    console.log(`\n Total: ${rests?.length || 0} restaurants`);
    
    // Search for anything with "crunk" or similar
    const matches = rests?.filter(r => r.name.toLowerCase().includes('crunk'));
    if (matches?.length) {
      console.log('\n✅ Found matches for "crunk":');
      matches.forEach(r => {
        console.log(`  - ${r.name}`);
      });
    } else {
      console.log('\n❌ No restaurants matching "crunk" found');
    }
    
  } catch (err) {
    console.error('ERROR:', err.message);
  }
}

listRestaurants();
