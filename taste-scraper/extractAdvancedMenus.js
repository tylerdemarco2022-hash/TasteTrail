const fs = require('fs');
const path = require('path');
const { parsePdfMenu, cleanMenuItems, validateExtraction } = require('./pdfMenuParser');
const { parseMenuWithAI } = require('./aiParser');

const restaurants = [
  {
    name: 'Supper_Land',
    url: 'https://supper.land/wp-content/uploads/11-x-17-size-menu-GENERIC-SPECIALS-1.pdf',
    type: 'pdf'
  },
  {
    name: 'Fahrenheit_Charlotte',
    url: 'https://fahrenheitrestaurants.com/charlotte-menu/',
    type: 'html'
  }
];

async function extractPdfMenu(restaurant) {
  console.log(`\n🍽️  Processing ${restaurant.name}...`);
  
  try {
    const pdfData = await parsePdfMenu(restaurant.url);
    
    // Validate extraction quality
    const validation = validateExtraction(pdfData);
    
    if (!validation.isValid) {
      console.log(`⚠️  Warnings:`, validation.warnings);
      if (validation.requiresManualReview) {
        console.log(`🔴 REQUIRES MANUAL REVIEW - Cannot auto-parse this PDF`);
        return {
          restaurant: restaurant.name,
          status: 'manual_review_required',
          warnings: validation.warnings,
          extractedText: pdfData.text,
          pageCount: pdfData.pageCount
        };
      }
    }

    // Parse with AI
    console.log(`🤖 Sending to OpenAI for structuring...`);
    const aiPrompt = `Extract all menu items from this restaurant menu text. Structure as JSON array with {name, category, description} for each item. 
Remove any non-food items, prices, addresses, phone numbers, copyright notices. 
Only include actual food/drink items from the menu. Groups items logically by category (Appetizers, Soups, Salads, Entrees, Desserts, Beverages, etc).

Menu Text:
${pdfData.text}`;

    const menuItems = await parseMenuWithAI(aiPrompt);
    const cleanedItems = cleanMenuItems(menuItems);

    // Save JSON
    const jsonPath = path.join(__dirname, `${restaurant.name}_Menu.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(cleanedItems, null, 2));

    console.log(`✅ SUCCESS: Extracted ${cleanedItems.length} menu items`);
    
    return {
      restaurant: restaurant.name,
      status: 'success',
      itemCount: cleanedItems.length,
      filePath: jsonPath,
      pageCount: pdfData.pageCount
    };

  } catch (error) {
    console.error(`❌ Error processing ${restaurant.name}:`, error.message);
    return {
      restaurant: restaurant.name,
      status: 'failed',
      error: error.message
    };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 ADVANCED MENU EXTRACTION WITH PDF PARSING');
  console.log('='.repeat(60));

  const results = [];

  // Process only PDF restaurants
  for (const restaurant of restaurants) {
    if (restaurant.type === 'pdf') {
      const result = await extractPdfMenu(restaurant);
      results.push(result);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 EXTRACTION SUMMARY');
  console.log('='.repeat(60));
  
  results.forEach(r => {
    if (r.status === 'success') {
      console.log(`✅ ${r.restaurant}: ${r.itemCount} items extracted (${r.pageCount} pages)`);
    } else if (r.status === 'manual_review_required') {
      console.log(`⚠️  ${r.restaurant}: REQUIRES MANUAL REVIEW`);
      console.log(`   Reason: ${r.warnings.join(', ')}`);
      console.log(`   Extracted: ${r.extractedText.length} characters`);
    } else {
      console.log(`❌ ${r.restaurant}: ${r.error}`);
    }
  });
}

main().catch(console.error);
