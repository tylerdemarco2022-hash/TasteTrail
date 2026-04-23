import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://szplopxrhawfwveiycru.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpdmV1anVnZ3Vma3BkbGVubnVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MjIyOTEsImV4cCI6MjA4MzI5ODI5MX0.ojRm53EF3z6hGjqKF6tEJaG2rPqtIvIfMUqTMQzAqIU'
);

async function debugCrunkleton() {
  try {
    // Find Crunkleton
    const { data: rests } = await supabase
      .from('restaurants')
      .select('id, name')
      .ilike('name', '%Crunkleton%');
    
    if (!rests?.length) {
      console.log('❌ No Crunkleton found');
      return;
    }
    
    const restId = rests[0].id;
    const restName = rests[0].name;
    
    console.log('🔍 Restaurant:', restName);
    console.log('ID:', restId);
    
    // Get all menu items
    const { data: items } = await supabase
      .from('menu_items')
      .select('id, name, section_name, category')
      .eq('restaurant_id', restId);
    
    const totalItems = items?.length || 0;
    console.log('\n📋 Total items:', totalItems);
    
    // Build section breakdown
    const sectionCounts = {};
    const categoryBreakdown = {};
    
    (items || []).forEach(item => {
      const section = item.section_name || 'NULL_SECTION';
      const category = item.category || 'NULL_CATEGORY';
      
      sectionCounts[section] = (sectionCounts[section] || 0) + 1;
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
    });
    
    console.log('\n📊 SECTION BREAKDOWN (by section_name):');
    Object.entries(sectionCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([section, count]) => {
        console.log(`  "${section}": ${count} items`);
      });
    
    console.log('\n📊 CATEGORY BREAKDOWN (by category):');
    Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`  "${category}": ${count} items`);
      });
      
    // Show sample items from each section
    console.log('\n📝 Sample items from each section:');
    const sections = Object.keys(sectionCounts);
    sections.slice(0, 3).forEach(section => {
      console.log(`\n  Section: "${section}"`);
      items
        .filter(item => (item.section_name || 'NULL_SECTION') === section)
        .slice(0, 3)
        .forEach(item => {
          console.log(`    - ${item.name || '(unnamed)'} [category: ${item.category}]`);
        });
    });
    
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

debugCrunkleton();
