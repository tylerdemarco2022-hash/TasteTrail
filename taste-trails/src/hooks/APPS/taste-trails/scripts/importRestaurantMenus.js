import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Try to use service role key, fall back to anon key
const apiKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;

if (!SUPABASE_URL || !apiKey) {
  console.error('❌ Error: SUPABASE_URL and API key env vars not set');
  console.error(`   SUPABASE_URL: ${SUPABASE_URL ? '✓' : '✗'}`);
  console.error(`   SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗'}`);
  console.error(`   SUPABASE_KEY: ${SUPABASE_KEY ? '✓' : '✗'}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, apiKey);

// Restaurant data with locations
const restaurants = [
  {
    menuFile: 'Sixty_Vines_Menu.json',
    name: 'Sixty Vines',
    address: '6000 Fairview Rd, Charlotte, NC 28210',
    cuisineType: 'Modern American',
    rating: 4.7
  },
  {
    menuFile: 'Culinary_Dropout_Menu.json',
    name: 'Culinary Dropout',
    address: 'Charlotte, NC',
    cuisineType: 'Contemporary American',
    rating: 4.5
  },
  {
    menuFile: 'The_Crunkleton_Dinner_Menu.json',
    name: 'The Crunkleton',
    address: 'Charlotte, NC',
    cuisineType: 'American Steakhouse',
    rating: 4.6
  },
  {
    menuFile: '131_Main_Dinner_Menu.json',
    name: '131 Main',
    address: 'Charlotte, NC',
    cuisineType: 'Southern Contemporary',
    rating: 4.5
  },
  {
    menuFile: 'Angelines_Dinner_Menu.json',
    name: "Angeline's",
    address: 'Charlotte, NC',
    cuisineType: 'American Fine Dining',
    rating: 4.4
  },
  {
    menuFile: 'Mama_Ricotta_s_Menu.json',
    name: "Mama Ricotta's",
    address: 'Charlotte, NC',
    cuisineType: 'Italian',
    rating: 4.6
  },
  {
    menuFile: 'Sea_Grill_Diner_Menu.json',
    name: 'Sea Grill Diner',
    address: 'Charlotte, NC',
    cuisineType: 'Seafood',
    rating: 4.3
  },
  {
    menuFile: 'Dean_s_Steakhouse_Menu.json',
    name: "Dean's Steakhouse",
    address: 'Charlotte, NC',
    cuisineType: 'Steakhouse',
    rating: 4.5
  },
  {
    menuFile: 'Postino_Menu.json',
    name: 'Postino',
    address: 'Charlotte, NC',
    cuisineType: 'Italian',
    rating: 4.4
  },
  {
    menuFile: 'Figtree_Dinner_Menu.json',
    name: 'Figtree',
    address: 'Charlotte, NC',
    cuisineType: 'American Contemporary',
    rating: 4.5
  },
  {
    menuFile: 'Stir_Charlotte_Menu.json',
    name: 'STIR Charlotte',
    address: '1422 S Tryon St, Charlotte, NC 28203',
    cuisineType: 'Fine Dining Seafood',
    rating: 4.6
  },
  {
    menuFile: 'La_Belle_Helene_Menu.json',
    name: 'La Belle Helene',
    address: 'Charlotte, NC',
    cuisineType: 'French Fine Dining',
    rating: 4.7
  },
  {
    menuFile: 'Restaurant_Constance_Menu.json',
    name: 'Restaurant Constance',
    address: '2200 Thrift Rd, Charlotte, NC 28208',
    cuisineType: 'Contemporary American',
    rating: 4.5
  },
  {
    menuFile: 'Fahrenheit_Charlotte_Menu.json',
    name: 'Fahrenheit',
    address: '222 S Caldwell St, Charlotte, NC 28202',
    cuisineType: 'Fine Dining',
    rating: 4.5
  },
  {
    menuFile: 'Supper_Land_Menu.json',
    name: 'Supper Land',
    address: 'Charlotte, NC',
    cuisineType: 'Southern Fine Dining',
    rating: 4.6
  }
];

async function importMenus() {
  console.log('\n========================================================================');
  console.log('IMPORTING RESTAURANT MENUS INTO TASTE-TRAILS');
  console.log('========================================================================\n');

  // Correct path: from taste-trails root, go to taste-scraper
  const tasteScraperPath = path.resolve(__dirname, '../../taste-scraper');
  const restaurantsDir = path.resolve(__dirname, '../backend/restaurants');
  
  console.log(`Looking for menus in: ${tasteScraperPath}`);
  
  if (!fs.existsSync(tasteScraperPath)) {
    console.error(`Error: taste-scraper directory not found at ${tasteScraperPath}`);
    process.exit(1);
  }

  // Create restaurants directory if it doesn't exist
  if (!fs.existsSync(restaurantsDir)) {
    fs.mkdirSync(restaurantsDir, { recursive: true });
  }
  
  let successCount = 0;
  let errorCount = 0;
  const results = [];

  for (const restaurant of restaurants) {
    try {
      const filePath = path.join(tasteScraperPath, restaurant.menuFile);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`SKIP ${restaurant.name}: File not found`);
        results.push({
          name: restaurant.name,
          status: 'failed',
          error: 'File not found'
        });
        errorCount++;
        continue;
      }

      // Read menu file
      const menuData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const itemCount = Array.isArray(menuData) ? menuData.length : 0;

      console.log(`IMPORT ${restaurant.name}...`);

      // First, try Supabase import
      let importedToSupabase = false;
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .upsert({
            name: restaurant.name,
            address: restaurant.address,
            cuisine_type: restaurant.cuisineType,
            menu: menuData,
            rating: restaurant.rating
          }, { onConflict: 'name' })
          .select();

        if (!error) {
          importedToSupabase = true;
          console.log(`   SUCCESS (Supabase): ${itemCount} items, ID: ${data?.[0]?.id}`);
        } else {
          console.log(`   Supabase: ${error.message}`);
        }
      } catch (supabaseError) {
        console.log(`   Supabase unavailable: ${supabaseError.message}`);
      }

      // Also save locally for backup
      const restaurantDir = path.join(restaurantsDir, restaurant.name.replace(/[^a-zA-Z0-9]/g, '_'));
      fs.mkdirSync(restaurantDir, { recursive: true });
      
      const menuPath = path.join(restaurantDir, 'menu.json');
      fs.writeFileSync(menuPath, JSON.stringify(menuData, null, 2));
      
      console.log(`   LOCAL: Saved to ${restaurantDir}`);

      results.push({
        name: restaurant.name,
        status: 'success',
        itemCount,
        imported: importedToSupabase
      });
      successCount++;

    } catch (error) {
      console.log(`FAIL ${restaurant.name}: ${error.message}`);
      results.push({
        name: restaurant.name,
        status: 'failed',
        error: error.message
      });
      errorCount++;
    }
  }

  // Summary
  console.log('\n========================================================================');
  console.log('IMPORT SUMMARY');
  console.log('========================================================================');
  console.log(`Successful: ${successCount}/${restaurants.length}`);
  console.log(`Failed: ${errorCount}/${restaurants.length}`);

  if (successCount > 0) {
    console.log('\nSuccessfully imported:');
    results
      .filter(r => r.status === 'success')
      .forEach(r => {
        const method = r.imported ? 'Supabase + Local' : 'Local';
        console.log(`   * ${r.name} (${r.itemCount} items, ${method})`);
      });
  }

  if (errorCount > 0) {
    console.log('\nFailed imports:');
    results
      .filter(r => r.status === 'failed')
      .forEach(r => {
        console.log(`   * ${r.name}: ${r.error}`);
      });
  }

  console.log('\n========================================================================');
  console.log(`COMPLETE: ${successCount}/${restaurants.length} restaurants imported!`);
  console.log('Menus stored in: backend/restaurants/');
  console.log('========================================================================\n');

  process.exit(errorCount > 0 ? 1 : 0);
}

// Run import
importMenus().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
