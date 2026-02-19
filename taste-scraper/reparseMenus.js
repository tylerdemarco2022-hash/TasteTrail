const parseMenu = require("./aiParser");
const fs = require("fs");
const path = require("path");

async function reParseRestaurant(name, rawTextFile, outputFile) {
  console.log(`Re-parsing ${name}...`);
  
  const rawPath = path.join(__dirname, rawTextFile);
  if (!fs.existsSync(rawPath)) {
    console.error(`  File not found: ${rawPath}`);
    return null;
  }
  
  const rawText = fs.readFileSync(rawPath, 'utf-8');
  console.log(`  Raw text: ${rawText.length} characters`);
  
  const menu = await parseMenu(rawText);
  
  let itemCount = 0;
  if (menu && menu.items) {
    itemCount = menu.items.length;
  } else if (Array.isArray(menu)) {
    itemCount = menu.length;
  }
  
  console.log(`  Parsed: ${itemCount} items`);
  
  const outputPath = path.join(__dirname, outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(menu, null, 2), 'utf-8');
  console.log(`  Saved to ${outputFile}`);
  
  return menu;
}

// Main
(async () => {
  try {
    console.log('Re-parsing restaurants with improved raw text...\n');
    
    await reParseRestaurant(
      'Sea Grill',
      'Sea_Grill_Diner_Menu_raw.txt',
      'Sea_Grill_Diner_Menu.json'
    );
    
    console.log('\nRe-parsing complete!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
