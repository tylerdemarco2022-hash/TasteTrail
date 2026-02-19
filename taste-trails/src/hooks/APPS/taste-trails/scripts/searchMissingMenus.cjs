const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Restaurants needing menus
const restaurantsNeedingMenus = [
  { name: 'Bao & Co', aliases: ['Bao and Co'], location: 'Charlotte, NC' },
  { name: 'Green Fork', aliases: ['Green Fork Cafe'], location: 'Charlotte, NC' },
  { name: 'Blue Bar Smokehouse', aliases: ['Blue Bar & Smokehouse'], location: 'Ft Mill, SC' },
  { name: 'Figtree', aliases: ['Fig Tree'], location: 'Charlotte, NC' },
  { name: 'Firebirds Wood Fired Grill', aliases: ['Firebirds'], location: 'Charlotte, NC' },
  { name: 'Grapevine', aliases: ['Grapevine Restaurant'], location: 'Charlotte, NC' },
  { name: 'Jekyll & Hyde Taphouse Grill', aliases: ['Jekyll Hyde'], location: 'Charlotte, NC' },
  { name: 'La Belle Helene', aliases: ['La Belle Helène'], location: 'Charlotte, NC' },
  { name: 'Poppyseed Kitchen', aliases: ['Poppy Seed'], location: 'Charlotte, NC' },
  { name: "Salmeri's Italian Kitchen", aliases: ["Salmeris"], location: 'Ft Mill, SC' },
  { name: 'The Foxhole Restaurant and Bar', aliases: ['The Foxhole'], location: 'Fort Mill, SC' },
  { name: 'The Improper Pig', aliases: ['Improper Pig'], location: 'Ft Mill, SC' },
  { name: "Whitaker's", aliases: ['Whitakers'], location: 'Charlotte, NC' },
  { name: 'Ilios Crafted Greek', aliases: ['Ilios Greek'], location: 'Fort Mill, SC' },
  { name: 'Spice Asian Kitchen', aliases: ['Spice Asian'], location: 'Charlotte, NC' },
  { name: 'Captain Steves Family Seafood', aliases: ['Captain Steves'], location: 'Charlotte, NC' }
];

// Alternative URL patterns to try
const alternativePatterns = [
  // DoorDash
  (name, loc) => `https://www.doordash.com/en-US/business/${name.toLowerCase().replace(/[&\s']+/g, '-')}/${loc.replace(/,\s*/g, '-').toLowerCase()}`,
  // UberEats
  (name, loc) => `https://www.ubereats.com/en-US/search?q=${name.replace(/\s+/g, '%20')}&pl=JTdCJTIyYWRkcmVzcyUyMiUzQSUyMiR%7Baddress}`,
  // Toast POS
  (name, loc) => `https://www.toasttab.com/menu/${name.toLowerCase().replace(/[&\s']+/g, '-')}`,
  // Facebook menu
  (name, loc) => `https://www.facebook.com/search/${name}/places/?location_type=RESTAURANT`,
  // Yelp
  (name, loc) => `https://www.yelp.com/search?find=${name.replace(/\s+/g, '%20')}&loc=${loc.replace(/\s+/g, '%20')}`,
];

// Fetch function with retries
async function fetchWithRetry(url, retries = 3, timeout = 8000) {
  for (let i = 0; i < retries; i++) {
    try {
      const content = await new Promise((resolve) => {
        const protocol = url.startsWith('https') ? https : http;
        let data = '';
        const timeoutId = setTimeout(() => resolve(null), timeout);

        protocol.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          timeout
        }, (res) => {
          if (res.statusCode === 200 || res.statusCode === 301 || res.statusCode === 302) {
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
              clearTimeout(timeoutId);
              resolve(res.statusCode === 200 ? data : null);
            });
          } else {
            clearTimeout(timeoutId);
            resolve(null);
          }
        }).on('error', () => {
          clearTimeout(timeoutId);
          resolve(null);
        });
      });

      if (content) return content;
    } catch (e) {
      // Continue to next retry
    }
    
    // Wait before retry
    await new Promise(r => setTimeout(r, 500 * (i + 1)));
  }
  return null;
}

// Extract menu items from HTML (improved)
function extractMenuItems(html) {
  if (!html) return [];

  const items = [];
  const seen = new Set();

  // JSON-LD structured data (many restaurants use this)
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
  if (jsonLdMatch) {
    try {
      const data = JSON.parse(jsonLdMatch[1]);
      if (data.hasMenu && Array.isArray(data.hasMenu)) {
        data.hasMenu.forEach(menu => {
          if (menu.hasMenuSection) {
            menu.hasMenuSection.forEach(section => {
              if (section.hasMenuItem) {
                section.hasMenuItem.forEach(item => {
                  if (item.name && !seen.has(item.name)) {
                    items.push({
                      name: item.name,
                      description: item.description || '',
                      category: section.name || 'Menu',
                      price: item.offers?.[0]?.price
                    });
                    seen.add(item.name);
                  }
                });
              }
            });
          }
        });
      }
    } catch (e) {
      // Continue with other methods
    }
  }

  // Look for menu divs and sections
  const menuRegex = /<div[^>]*class="[^"]*menu[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
  const matches = html.matchAll(menuRegex);
  for (const match of matches) {
    const menuSection = match[0];
    const itemRegex = /([A-Z][a-zA-Z\s&'-]+?)(?:\$|£|€)?(\d+\.?\d*)?[\s\n]*([^<]*?)(?=<br|<\/li|<\/p|<\/div|$)/gi;

    let itemMatch;
    while ((itemMatch = itemRegex.exec(menuSection)) !== null) {
      const name = itemMatch[1]?.trim();
      if (name && name.length > 2 && !seen.has(name) && name.length < 150) {
        items.push({
          name,
          description: itemMatch[3]?.trim() || '',
          category: 'Menu',
          price: itemMatch[2] ? parseFloat(itemMatch[2]) : undefined
        });
        seen.add(name);
      }
    }
  }

  return Array.from(new Map(items.map(i => [i.name, i])).values()).slice(0, 150);
}

// Main search function
async function searchAndFetchMenu(restaurant) {
  console.log(`\n🔍 Searching for ${restaurant.name}...`);

  for (const pattern of alternativePatterns) {
    const url = pattern(restaurant.name, restaurant.location);
    console.log(`  🔗 ${url.substring(0, 60)}...`);

    const content = await fetchWithRetry(url);
    if (content) {
      const items = extractMenuItems(content);
      if (items.length > 5) {
        console.log(`  ✅ Found ${items.length} items!`);
        return items;
      }
    }
  }

  console.log(`  ⚠️  Could not find menu online`);
  return null;
}

// Main
async function main() {
  console.log('🍽️  Searching for missing restaurant menus...\n');

  for (const restaurant of restaurantsNeedingMenus) {
    const items = await searchAndFetchMenu(restaurant);
    if (items && items.length > 0) {
      console.log(`  📊 ${items.length} menu items found`);
    }
  }

  console.log('\n✅ Search complete!');
}

main().catch(console.error);
