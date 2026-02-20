// Automated script to find dinner menu URLs, scrape, and save menus for all restaurants
// Usage: node automateMenuDiscovery.js

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { findDinnerMenuUrl } = require('./taste-trails/src/services/dinnerMenuFinder');
const menuScraperAgent = require('./agents/menuScraperAgent');

const API_BASE = 'http://localhost:8081';

async function getAllRestaurants() {
  const res = await axios.get(`${API_BASE}/api/restaurants`);
  return res.data;
}

async function saveMenu(restaurantId, restaurantName, menuUrl, menuData) {
  await axios.post(`${API_BASE}/api/scrape-menu`, {
    url: menuUrl,
    restaurant_id: restaurantId,
    restaurant_name: restaurantName,
    menu: menuData
  });
}

(async () => {
  const restaurants = await getAllRestaurants();
  const foundMenus = [];
  for (const r of restaurants) {
    if (!r.website) continue;
    console.log(`Finding dinner menu for: ${r.name} (${r.website})`);
    const dinnerResult = await findDinnerMenuUrl(r.website);
    if (dinnerResult.status !== 'success' || !dinnerResult.allCandidates || !dinnerResult.allCandidates.length) {
      console.log(`No dinner menu candidates found for ${r.name}`);
      continue;
    }
    let menuFound = false;
    for (const candidate of dinnerResult.allCandidates) {
      const menuUrl = candidate.url;
      console.log(`Trying menu URL: ${menuUrl}`);
      const menuData = await menuScraperAgent({ name: r.name, website: menuUrl });
      if (menuData && menuData.menu_sections && menuData.menu_sections.length > 0) {
        foundMenus.push({ name: r.name, id: r.id, url: menuUrl });
        await saveMenu(r.id, r.name, menuUrl, menuData);
        console.log(`Saved menu for ${r.name} from ${menuUrl}`);
        menuFound = true;
        break;
      } else {
        console.log(`No menu found at ${menuUrl}, trying next candidate...`);
      }
    }
    if (!menuFound) {
      console.log(`Failed to find a working dinner menu for ${r.name}`);
    }
  }
  fs.writeFileSync('found_dinner_menus.json', JSON.stringify(foundMenus, null, 2));
  console.log('All done!');
})();
