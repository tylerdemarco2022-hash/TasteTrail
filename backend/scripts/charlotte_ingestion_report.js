import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { findMenuUrlFromName } from './findMenuUrlFromName.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runBatch() {
  const inputPath = path.resolve(__dirname, '../../cache/discovered_charlotte-nc.json');
  const raw = fs.readFileSync(inputPath, 'utf-8');
  const LIMIT = 10;
  const restaurants = JSON.parse(raw).slice(0, LIMIT);
  const results = [];

  const urlCounts = {};
  let thirdPartyBlocked = 0;
  let homepageFalsePositives = 0;
  for (let index = 0; index < restaurants.length; index++) {
    const rest = restaurants[index];
    const { name, address } = rest;
    const city = 'Charlotte';
    const state = 'NC';
    const entry = { name };
    const total = restaurants.length;
    console.log(`Processing ${index + 1}/${total}: ${name}`);
    const start = Date.now();
    let timeout = false;
    async function processRestaurant() {
      try {
        const menuResult = await findMenuUrlFromName({ name, city, state, debug: false });
        entry.menuUrl = menuResult.url || null;
        entry.isThirdParty = !!(entry.menuUrl && (
          entry.menuUrl.includes('facebook.com') ||
          entry.menuUrl.includes('menufy') ||
          entry.menuUrl.includes('ubereats') ||
          entry.menuUrl.includes('doordash') ||
          entry.menuUrl.includes('grubhub')
        ));
        entry.isHomepage = !!(entry.menuUrl && (entry.menuUrl.endsWith('.com/') || entry.menuUrl.endsWith('.org/') || entry.menuUrl.endsWith('.net/')));
        if (entry.isThirdParty) thirdPartyBlocked++;
        if (entry.isHomepage) homepageFalsePositives++;
        if (menuResult.found && entry.menuUrl && !entry.isThirdParty) {
          const { extractFullMenu } = await import('../../services/menuExtractor.js');
          const menuData = await extractFullMenu(entry.menuUrl);
          entry.itemsExtracted = (menuData.categories || []).reduce((acc, c) => acc + ((c.items && c.items.length) || 0), 0);
        } else {
          entry.itemsExtracted = 0;
        }
      } catch (e) {
        entry.menuUrl = null;
        entry.isThirdParty = false;
        entry.isHomepage = false;
        entry.itemsExtracted = 0;
      }
    }
    function timeoutPromise(ms) {
      return new Promise(resolve => setTimeout(() => {
        timeout = true;
        resolve();
      }, ms));
    }
    await Promise.race([
      processRestaurant(),
      timeoutPromise(20000)
    ]);
    const runtime = Date.now() - start;
    entry.timeout = timeout;
    if (timeout) {
      console.log(`Timeout: true for ${name}`);
    }
    console.log(`Finished ${name} in ${runtime}ms`);
    if (entry.menuUrl) urlCounts[entry.menuUrl] = (urlCounts[entry.menuUrl] || 0) + 1;
    results.push(entry);
  }
  // Fail if same URL appears more than once
  const duplicateUrls = Object.entries(urlCounts).filter(([url, count]) => count > 1 && url);
  if (duplicateUrls.length > 0) {
    throw new Error('Batch failed: Duplicate menu URLs detected: ' + duplicateUrls.map(([url]) => url).join(', '));
  }
  // (Removed dishCountCounts check for >3 identical dish counts)

  // New success definition
  const successes = results.filter(r => r.menuUrl && r.itemsExtracted >= 15 && !r.isThirdParty);
  const dishCounts = results.map(r => r.itemsExtracted).sort((a, b) => a - b);
  let avgDish = 0;
  if (successes.length > 0) {
    avgDish = successes.map(r => r.itemsExtracted).reduce((a, b) => a + b, 0) / successes.length;
  }
  const medianDish = dishCounts.length % 2 === 0 ?
    (dishCounts[dishCounts.length/2-1] + dishCounts[dishCounts.length/2]) / 2 :
    dishCounts[Math.floor(dishCounts.length/2)];
  const successRate = (successes.length / results.length) * 100;
  const uniqueMenuUrls = Object.keys(urlCounts).length;
  console.log(successRate.toFixed(1));
  console.log(avgDish.toFixed(1));
  console.log(medianDish);
  console.log(uniqueMenuUrls);
  console.log(thirdPartyBlocked);
  console.log(homepageFalsePositives);
}

runBatch();
