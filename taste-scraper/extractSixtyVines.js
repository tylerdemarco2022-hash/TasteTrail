const fs = require('fs');
const path = require('path');

/**
 * Extract Sixty Vines menu from Next.js __NEXT_DATA__ JSON
 * The Charlotte location has rich menu data organized by categories:
 * - boards (appetizers)
 * - main (entrees)
 * - dessert
 * - cocktail
 * - beer
 * - cellar (wine)
 * - mainEggs (breakfast)
 * - extra (sides)
 * - mocktail
 * - cafe (coffee/tea)
 */

function extractSixtyVines() {
  const htmlFile = path.join(__dirname, 'Sixty_Vines_Menu.html');
  const htmlContent = fs.readFileSync(htmlFile, 'utf-8');

  // Extract __NEXT_DATA__ from the HTML
  const nextDataMatch = htmlContent.match(/<script id="__NEXT_DATA__"[^>]*>({.*?})<\/script>/s);
  if (!nextDataMatch) {
    console.error('Could not find __NEXT_DATA__');
    return null;
  }

  let pageProps;
  try {
    const nextData = JSON.parse(nextDataMatch[1]);
    pageProps = nextData.props?.pageProps || {};
  } catch (e) {
    console.error('Failed to parse __NEXT_DATA__:', e.message);
    return null;
  }

  // Find Charlotte location
  const locations = pageProps.locations || [];
  
  // Find Charlotte location (or use first available)
  let targetLocation = locations.find(loc => 
    loc.title?.toLowerCase().includes('charlotte') ||
    loc.address?.toLowerCase().includes('charlotte')
  );

  if (!targetLocation) {
    console.error('Charlotte location not found. Available locations:');
    locations.forEach((loc, i) => console.log(`  ${i}: ${loc.title || loc.address}`));
    // Use first location if Charlotte not found
    if (locations.length > 0) {
      console.log('Using first location instead...');
      targetLocation = locations[0];
    } else {
      return null;
    }
  }

  console.log(`Found location: ${targetLocation.title || targetLocation.address}`);
  return extractLocationMenu(targetLocation, pageProps);
}

function extractLocationMenu(location, pageProps) {
  const menu = {
    name: 'Sixty Vines',
    location: location.title || location.address,
    items: []
  };

  // Helper to get category name from reference
  const getCategoryName = (refObj, categoryArray) => {
    if (!refObj || !Array.isArray(categoryArray)) return '';
    const catId = refObj._ref || refObj;
    const cat = categoryArray.find(c => c._id === catId);
    return cat?.title || '';
  };

  // The location has direct arrays with full item objects
  const categoryMappings = [
    { key: 'boards', defaultName: 'Appetizers', categoryArray: pageProps.boardsCategories || [] },
    { key: 'main', defaultName: 'Main Courses', categoryArray: [] },
    { key: 'dessert', defaultName: 'Dessert', categoryArray: [] },
    { key: 'cocktail', defaultName: 'Cocktails', categoryArray: [] },
    { key: 'beer', defaultName: 'Beer', categoryArray: [] },
    { key: 'cellar', defaultName: 'Wine', categoryArray: pageProps.cellarCategories || [] },
    { key: 'mainEggs', defaultName: 'Brunch', categoryArray: [] },
    { key: 'extra', defaultName: 'Extras', categoryArray: [] },
    { key: 'mocktail', defaultName: 'Mocktails', categoryArray: [] },
    { key: 'cafe', defaultName: 'Cafe', categoryArray: [] },
    { key: 'pasta', defaultName: 'Pasta', categoryArray: [] },
    { key: 'pizza', defaultName: 'Pizza', categoryArray: [] },
    { key: 'salad', defaultName: 'Salads', categoryArray: [] },
    { key: 'sandwich', defaultName: 'Sandwiches', categoryArray: [] },
    { key: 'shared', defaultName: 'Shared', categoryArray: [] }
  ];

  categoryMappings.forEach(mapping => {
    const locationItems = location[mapping.key];
    if (!Array.isArray(locationItems)) return;

    locationItems.forEach(item => {
      if (!item || typeof item !== 'object') return;
      if (!item.title) return;

      // Determine category name
      let categoryName = mapping.defaultName;
      if (item.boardsCategories && mapping.categoryArray.length > 0) {
        const catName = getCategoryName(item.boardsCategories, mapping.categoryArray);
        if (catName) categoryName = catName;
      } else if (item.cellarCategories && mapping.categoryArray.length > 0) {
        const catName = getCategoryName(item.cellarCategories, mapping.categoryArray);
        if (catName) categoryName = catName;
      }

      const menuItem = {
        name: item.title.trim(),
        description: (item.description || '').trim(),
        category: categoryName
      };

      menu.items.push(menuItem);
    });
  });

  return menu;
}

// Main execution
const menu = extractSixtyVines();
if (menu) {
  console.log(`\nExtracted ${menu.items.length} items from Sixty Vines`);
  
  // Group by category
  const byCategory = {};
  menu.items.forEach(item => {
    const cat = item.category || 'Uncategorized';
    if (!byCategory[cat]) byCategory[cat] = 0;
    byCategory[cat]++;
  });
  
  console.log('\nItems by category:');
  Object.entries(byCategory).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

  // Save to JSON
  const outputPath = path.join(__dirname, 'Sixty_Vines_Menu_extracted.json');
  fs.writeFileSync(outputPath, JSON.stringify(menu, null, 2), 'utf-8');
  console.log(`\nSaved to ${outputPath}`);
} else {
  console.error('Failed to extract menu');
  process.exit(1);
}
