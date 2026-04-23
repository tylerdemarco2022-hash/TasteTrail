#!/usr/bin/env node

/**
 * ONE-TIME DATA MIGRATION SCRIPT
 * 
 * Purpose: Repair existing menu_items rows by populating section_name field
 * 
 * Logic:
 * - If section_name is NULL or empty:
 *   - Use category field if it exists and is not empty
 *   - Otherwise set to "Uncategorized"
 * 
 * Usage:
 *   node backend/scripts/migrate-section-names.mjs
 * 
 * Safety: Read-only preview by default. Use --commit flag to apply changes.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR: Missing Supabase credentials in .env file');
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DRY_RUN = !process.argv.includes('--commit');

async function migrateMenuItemSections() {
  console.log('🔧 Menu Items Section Name Migration');
  console.log('=====================================\n');
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE (read-only preview)');
    console.log('To apply changes, run: node backend/scripts/migrate-section-names.mjs --commit\n');
  } else {
    console.log('⚠️  COMMIT MODE - Changes will be written to database\n');
  }
  
  try {
    // Fetch all menu items
    console.log('📊 Fetching menu items...');
    const { data: items, error: fetchError } = await supabase
      .from('menu_items')
      .select('id, name, category, section_name, restaurant_id');
    
    if (fetchError) {
      console.error('❌ Error fetching menu items:', fetchError.message);
      process.exit(1);
    }
    
    console.log(`✅ Found ${items.length} total menu items\n`);
    
    // Identify items needing repair
    const needsRepair = items.filter(item => {
      const currentSectionName = item.section_name?.trim();
      return !currentSectionName || currentSectionName === '';
    });
    
    console.log(`🔍 Analysis:`);
    console.log(`   Total items: ${items.length}`);
    console.log(`   Need repair: ${needsRepair.length} (${((needsRepair.length / items.length) * 100).toFixed(1)}%)`);
    console.log(`   Already OK:  ${items.length - needsRepair.length}\n`);
    
    if (needsRepair.length === 0) {
      console.log('✅ No items need repair. Migration complete!');
      return;
    }
    
    // Build repair payloads
    const repairs = needsRepair.map(item => {
      const categoryValue = item.category?.trim();
      const newSectionName = categoryValue || 'Uncategorized';
      
      return {
        id: item.id,
        name: item.name,
        restaurant_id: item.restaurant_id,
        old_section_name: item.section_name,
        old_category: item.category,
        new_section_name: newSectionName
      };
    });
    
    // Group by repair type for reporting
    const fromCategory = repairs.filter(r => r.old_category?.trim());
    const toUncategorized = repairs.filter(r => !r.old_category?.trim());
    
    console.log(`📋 Repair Plan:`);
    console.log(`   Copy from category: ${fromCategory.length}`);
    console.log(`   Set to Uncategorized: ${toUncategorized.length}\n`);
    
    // Show sample repairs
    console.log(`📝 Sample repairs (first 10):`);
    repairs.slice(0, 10).forEach((r, idx) => {
      console.log(`   ${idx + 1}. "${r.name}" (ID: ${r.id})`);
      console.log(`      category: "${r.old_category || '(empty)'}"`);
      console.log(`      section_name: "${r.old_section_name || '(null)'}" → "${r.new_section_name}"`);
    });
    console.log('');
    
    if (DRY_RUN) {
      console.log('✅ Dry run complete. Review above and run with --commit to apply changes.');
      return;
    }
    
    // COMMIT MODE: Apply updates
    console.log('🚀 Applying updates...\n');
    
    let successCount = 0;
    let errorCount = 0;
    const batchSize = 100;
    
    for (let i = 0; i < repairs.length; i += batchSize) {
      const batch = repairs.slice(i, i + batchSize);
      
      for (const repair of batch) {
        const { error: updateError } = await supabase
          .from('menu_items')
          .update({ section_name: repair.new_section_name })
          .eq('id', repair.id);
        
        if (updateError) {
          console.error(`   ❌ Failed to update ID ${repair.id}: ${updateError.message}`);
          errorCount++;
        } else {
          successCount++;
        }
      }
      
      // Progress indicator
      const progress = Math.min(i + batchSize, repairs.length);
      console.log(`   Progress: ${progress}/${repairs.length} (${((progress / repairs.length) * 100).toFixed(1)}%)`);
    }
    
    console.log('');
    console.log('✅ Migration complete!');
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors:  ${errorCount}`);
    console.log(`   Total:   ${repairs.length}`);
    
    // Verify migration
    console.log('\n🔍 Verification check...');
    const { data: postMigration, error: verifyError } = await supabase
      .from('menu_items')
      .select('section_name')
      .or('section_name.is.null,section_name.eq.');
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
    } else {
      const remainingNulls = postMigration?.length || 0;
      if (remainingNulls === 0) {
        console.log('✅ Verification passed: No NULL or empty section_name values remain');
      } else {
        console.warn(`⚠️  Warning: ${remainingNulls} items still have NULL/empty section_name`);
      }
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

// Run migration
migrateMenuItemSections()
  .then(() => {
    console.log('\n✅ Script finished successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Script failed:', err);
    process.exit(1);
  });
