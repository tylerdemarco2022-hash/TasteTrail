const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Found URLs from discovery
const foundURLs = JSON.parse(fs.readFileSync(path.join(__dirname, '../menu-urls-found.json'), 'utf8'));

// Restaurant directory mappings
const restaurantDirs = {
  'Bao & Co': 'Bao_Co',
  'Saffron Spoon': 'Saffron_Spoon',
  'Green Fork': 'Green_Fork',
  'The Mill House': 'The_Mill_House',
  'Sea Grill Diner': 'Sea_Grill_Diner',
  'Sixty Vines': 'Sixty_Vines',
  '131 Main': '131_Main',
  "Angeline's": 'Angeline_s',
  'Blue Bar Smokehouse': 'Blue_Bar_Smokehouse',
  'Culinary Dropout': 'Culinary_Dropout',
  "Dean's Steakhouse": 'Dean_s_Steakhouse',
  'Fahrenheit': 'Fahrenheit',
  'Figtree': 'Figtree',
  'Firebirds Wood Fired Grill': 'Firebirds_Wood_Fired_Grill',
  'Grapevine': 'Grapevine',
  'Ilios Crafted Greek': 'Ilios_crafted_greek',
  'Jekyll & Hyde Taphouse Grill': 'Jekyll_Hyde_Taphouse_Grill',
  'La Belle Helene': 'La_Belle_Helene',
  "Mama Ricotta's": 'Mama_Ricotta_s',
  'Poppyseed Kitchen': 'Poppyseed_Kitchen',
  'Postino': 'Postino',
  'Restaurant Constance': 'Restaurant_Constance',
  "Salmeri's Italian Kitchen": 'Salmeris_Italian_Kitchen',
  'STIR Charlotte': 'STIR_Charlotte',
  'Supper Land': 'Supper_Land',
  'The Crunkleton': 'The_Crunkleton',
  'The Foxhole Restaurant and Bar': 'The_Foxhole_Restaurant_And_Bar',
  'The Improper Pig': 'The_Improper_Pig',
  "Whitaker's": 'Whitakers'
};

// Fetch URL content
function fetchContent(url, timeout = 10000) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    let content = '';
    const timeoutId = setTimeout(() => {
      resolve(null);
    }, timeout);

    protocol.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: timeout
    }, (res) => {
      res.on('data', chunk => { content += chunk; });
      res.on('end', () => {
        clearTimeout(timeoutId);
        resolve(res.statusCode === 200 ? content : null);
      });
    }).on('error', () => {
      clearTimeout(timeoutId);
      resolve(null);
    });
  });
}

// Extract menu items from HTML (simple pattern matching)
function extractMenuItemsFromHTML(html) {
  const items = [];
  
  // Common menu item patterns
  const patterns = [
    /(?:<h[2-4]>|<strong>|<div class="[^"]*menu[^"]*">)([^<]+)<\/[^>]+>(?:<p>|<span>)?([^<]+)?<\/(?:p|span)>/gi,
    /([A-Z][a-z\s&'-]+)\s*(?:\$|£|€)?(\d+\.?\d*)\s*([^<]*)/g,
    /<li[^>]*>([^<]+)<\/li>/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      if (match[1] && match[1].trim().length > 2) {
        items.push({
          name: match[1].trim(),
          description: match[2] ? match[2].trim() : '',
          category: 'Menu'
        });
      }
    }
  }

  return items.slice(0, 100); // Limit to 100 items for now
}

// Try to fetch menu for a restaurant
async function fetchMenuForRestaurant(restaurantName) {
  const urls = foundURLs[restaurantName] || [];
  
  if (urls.length === 0) {
    console.log(`  ❌ No URLs found for ${restaurantName}`);
    return null;
  }

  for (const urlObj of urls) {
    console.log(`    🔗 Trying: ${urlObj.url}`);
    const content = await fetchContent(urlObj.url);
    
    if (content) {
      const items = extractMenuItemsFromHTML(content);
      if (items.length > 0) {
        console.log(`    ✅ Found ${items.length} menu items`);
        return items;
      }
    }
  }

  console.log(`  ⚠️  Could not extract menu items for ${restaurantName}`);
  return null;
}

// Save menu to file
function saveMenu(restaurantName, items) {
  const dirName = restaurantDirs[restaurantName];
  if (!dirName) {
    console.log(`  ⚠️  No directory mapping for ${restaurantName}`);
    return;
  }

  const dirPath = path.join(__dirname, '../backend/restaurants', dirName);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const menuPath = path.join(dirPath, 'menu.json');
  fs.writeFileSync(menuPath, JSON.stringify(items, null, 2));
  console.log(`  📁 Saved to ${dirName}/menu.json`);
}

// Main function
async function main() {
  console.log('🍽️  Starting automated menu fetching and saving...\n');
  
  let successCount = 0;
  let totalCount = 0;

  for (const restaurantName of Object.keys(restaurantDirs)) {
    totalCount++;
    console.log(`\n${restaurantName}`);
    
    const menuItems = await fetchMenuForRestaurant(restaurantName);
    
    if (menuItems && menuItems.length > 0) {
      saveMenu(restaurantName, menuItems);
      successCount++;
    }
  }

  console.log(`\n📊 Complete! ${successCount}/${totalCount} restaurants processed`);
  console.log(`\nSaved menus to: backend/restaurants/*/menu.json`);
}

main().catch(console.error);
