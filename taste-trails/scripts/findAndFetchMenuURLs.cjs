const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// List of restaurants needing menus
const restaurants = [
  { name: 'Bao & Co', aliases: ['Bao and Co', 'Bao Co'], location: 'Charlotte, NC' },
  { name: 'Saffron Spoon', aliases: ['Saffron Spoon Indian'], location: 'Charlotte, NC' },
  { name: 'Green Fork', aliases: ['Green Fork Cafe', 'The Green Fork'], location: 'Charlotte, NC' },
  { name: 'The Mill House', aliases: ['The Mill House Restaurant'], location: 'Charlotte, NC' },
  { name: 'Sea Grill Diner', aliases: ['Sea Grill'], location: 'Charlotte, NC' },
  { name: 'Sixty Vines', aliases: ['60 Vines'], location: 'Charlotte, NC' },
  { name: '131 Main', aliases: ['131 Main Street'], location: 'Ft Mill, SC' },
  { name: "Angeline's", aliases: ["Angelines"], location: 'Charlotte, NC' },
  { name: 'Blue Bar Smokehouse', aliases: ['Blue Bar & Smokehouse'], location: 'Ft Mill, SC' },
  { name: 'Culinary Dropout', aliases: ['Culinary Dropout Charlotte'], location: 'Charlotte, NC' },
  { name: "Dean's Steakhouse", aliases: ["Deans Steakhouse"], location: 'Ft Mill, SC' },
  { name: 'Fahrenheit', aliases: ['Fahrenheit Restaurant'], location: 'Charlotte, NC' },
  { name: 'Figtree', aliases: ['Fig Tree', 'Figtree Restaurant'], location: 'Charlotte, NC' },
  { name: 'Firebirds Wood Fired Grill', aliases: ['Firebirds'], location: 'Charlotte, NC' },
  { name: 'Grapevine', aliases: ['Grapevine Restaurant'], location: 'Charlotte, NC' },
  { name: 'Ilios Crafted Greek', aliases: ['Ilios Greek', 'Ilios Fort Mill'], location: 'Ft Mill, SC' },
  { name: 'Jekyll & Hyde Taphouse Grill', aliases: ['Jekyll Hyde', 'Jekyll and Hyde'], location: 'Charlotte, NC' },
  { name: 'La Belle Helene', aliases: ['La Belle Helène'], location: 'Charlotte, NC' },
  { name: 'Mama Ricotta\'s', aliases: ['Mama Ricottas', 'Mama Ricotta'], location: 'Charlotte, NC' },
  { name: 'Poppyseed Kitchen', aliases: ['Poppy Seed', 'Poppyseed'], location: 'Charlotte, NC' },
  { name: 'Postino', aliases: ['Postino Charlotte'], location: 'Charlotte, NC' },
  { name: 'Restaurant Constance', aliases: ['Constance'], location: 'Charlotte, NC' },
  { name: "Salmeri's Italian Kitchen", aliases: ["Salmeris", "Salmeri's"], location: 'Ft Mill, SC' },
  { name: 'STIR Charlotte', aliases: ['STIR', 'Stir Charlotte'], location: 'Charlotte, NC' },
  { name: 'Supper Land', aliases: ['Supper Land Restaurant'], location: 'Charlotte, NC' },
  { name: 'The Crunkleton', aliases: ['Crunkleton'], location: 'Charlotte, NC' },
  { name: 'The Foxhole Restaurant and Bar', aliases: ['The Foxhole', 'Foxhole'], location: 'Fort Mill, SC' },
  { name: 'The Improper Pig', aliases: ['Improper Pig', 'The Improper Pig Fort Mill'], location: 'Ft Mill, SC' },
  { name: "Whitaker's", aliases: ['Whitakers'], location: 'Charlotte, NC' }
];

// URL patterns to try for each restaurant
const urlPatterns = [
  (name, location) => `https://${name.toLowerCase().replace(/[&\s']+/g, '')}.com/menu`,
  (name, location) => `https://www.${name.toLowerCase().replace(/[&\s']+/g, '')}.com/menu`,
  (name, location) => `https://${name.toLowerCase().replace(/[&\s']+/g, '')}.com`,
  (name, location) => `https://www.${name.toLowerCase().replace(/[&\s']+/g, '')}.com`,
  (name, location) => `https://${name.toLowerCase().replace(/\s+/g, '-')}.com/menu`,
  (name, location) => `https://www.${name.toLowerCase().replace(/\s+/g, '-')}.com/menu`,
  (name, location) => `https://${name.toLowerCase().replace(/\s+/g, '-')}.com`,
  (name, location) => `https://www.${name.toLowerCase().replace(/\s+/g, '-')}.com`,
];

// Fetch URL with timeout
function fetchURL(url, timeout = 5000) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const timeoutId = setTimeout(() => {
      resolve({ success: false, status: 'timeout', url });
    }, timeout);

    protocol.get(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: timeout
    }, (res) => {
      clearTimeout(timeoutId);
      resolve({ 
        success: res.statusCode === 200, 
        status: res.statusCode, 
        url 
      });
    }).on('error', () => {
      clearTimeout(timeoutId);
      resolve({ success: false, status: 'error', url });
    });
  });
}

// Find URLs for a restaurant
async function findRestaurantURLs(restaurant) {
  console.log(`\n🔍 Searching for URLs: ${restaurant.name}`);
  const foundURLs = [];

  for (const pattern of urlPatterns) {
    const url = pattern(restaurant.name, restaurant.location);
    const result = await fetchURL(url);
    
    if (result.success) {
      console.log(`  ✅ Found: ${url}`);
      foundURLs.push({ url, type: 'website' });
    } else {
      console.log(`  ❌ No: ${url} (${result.status})`);
    }
  }

  // Also try common menu platforms
  const menuPlatforms = [
    { key: 'menupix', prefix: `https://menupix.com/${restaurant.name.replace(/\s+/g, '-').toLowerCase()}` },
    { key: 'crunchbutton', prefix: `https://crunchbutton.com/restaurant/${restaurant.name.replace(/\s+/g, '-').toLowerCase()}` },
    { key: 'allmenus', prefix: `https://www.allmenus.com/nc/${restaurant.name.replace(/\s+/g, '-').toLowerCase()}` },
  ];

  for (const platform of menuPlatforms) {
    const result = await fetchURL(platform.prefix);
    if (result.success) {
      console.log(`  ✅ Found on ${platform.key}: ${platform.prefix}`);
      foundURLs.push({ url: platform.prefix, type: platform.key });
    }
  }

  return foundURLs;
}

// Main function
async function main() {
  console.log('🚀 Starting automated menu URL discovery...\n');
  const results = {};

  for (const restaurant of restaurants) {
    results[restaurant.name] = await findRestaurantURLs(restaurant);
  }

  // Save results
  const outputFile = path.join(__dirname, '../menu-urls-found.json');
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  
  console.log(`\n✅ URL discovery complete! Results saved to menu-urls-found.json`);
  
  // Summary
  let successCount = 0;
  for (const [name, urls] of Object.entries(results)) {
    if (urls.length > 0) {
      successCount++;
      console.log(`  ${name}: ${urls.length} URL(s) found`);
    } else {
      console.log(`  ${name}: ❌ No URLs found`);
    }
  }
  
  console.log(`\n📊 Total: ${successCount}/${restaurants.length} restaurants with URLs found`);
}

main().catch(console.error);
