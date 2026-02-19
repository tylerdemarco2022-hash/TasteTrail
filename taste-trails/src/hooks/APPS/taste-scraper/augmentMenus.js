const fs = require('fs');
const path = require('path');
const supplemental = require('./supplementalData');

function augmentMenu(currentMenu, supplementalItems) {
  let items = [];
  
  if (!currentMenu) {
    items = [];
  } else if (Array.isArray(currentMenu)) {
    items = currentMenu;
  } else if (currentMenu.items && Array.isArray(currentMenu.items)) {
    items = currentMenu.items;
  } else if (currentMenu.sections && Array.isArray(currentMenu.sections)) {
    // Handle sections format
    currentMenu.sections.forEach(s => {
      if (s.items && Array.isArray(s.items)) {
        items = items.concat(s.items);
      }
    });
  }
  
  // Get existing item names (case-insensitive) to avoid duplicates
  const existingNames = new Set(
    items.map(item => {
      const name = item.name || item.title || '';
      return name.toLowerCase().trim();
    })
  );
  
  // Add supplemental items that aren't already present
  supplementalItems.forEach(item => {
    const itemNameLower = (item.name || '').toLowerCase().trim();
    if (!existingNames.has(itemNameLower) && item.name) {
      items.push(item);
    }
  });
  
  // If original was array, return array; otherwise return object with items
  if (Array.isArray(currentMenu)) {
    return items;
  }
  
  return { items };
}

function augmentMenuFile(jsonFile, supplementalItems, name) {
  const filepath = path.join(__dirname, jsonFile);
  
  console.log(`Augmenting ${name}...`);
  
  let menu = null;
  if (fs.existsSync(filepath)) {
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      menu = JSON.parse(content);
    } catch (e) {
      console.error(`  Failed to parse ${jsonFile}: ${e.message}`);
      menu = null;
    }
  }
  
  const beforeCount = menu && menu.items ? menu.items.length : 0;
  menu = augmentMenu(menu, supplementalItems);
  const afterCount = menu.items ? menu.items.length : 0;
  
  fs.writeFileSync(filepath, JSON.stringify(menu, null, 2), 'utf-8');
  
  console.log(`  Before: ${beforeCount} items, After: ${afterCount} items (added ${afterCount - beforeCount})`);
}

// Main
console.log('Augmenting restaurant menus with supplemental data...\n');

augmentMenuFile('Sea_Grill_Diner_Menu.json', supplemental.seaGrillItems, 'Sea Grill');
augmentMenuFile('Postino_Menu.json', supplemental.postinoItems, 'Postino');
augmentMenuFile('Mama_Ricotta_s_Menu.json', supplemental.mamaRicottasItems, 'Mama Ricotta\'s');

console.log('\nDone!');
