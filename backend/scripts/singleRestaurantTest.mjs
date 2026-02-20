// backend/scripts/singleRestaurantTest.mjs
import path from 'path';
import { findMenuUrlFromName } from './findMenuUrlFromName.js';
import { findDomain } from '../../services/domainFinder.js';
import { scrapeMenu } from '../../menu-ingestion/services/menuScraper.js';


// Example input (replace as needed)
const name = 'The Cowfish Sushi Burger Bar';
const city = 'Charlotte';
const state = 'NC';


(async () => {
  // 1. Log input parameters
  console.log("INPUT:", name, city, state);

  // 2. Run domainFinder directly and log exact result
  let domainResult;
  try {
    domainResult = await findDomain({ name, city, state });
    console.log("DOMAIN RESULT:", domainResult);
  } catch (err) {
    console.log('DomainFinder error:', err.message || err);
    domainResult = null;
  }

  // 4. Run findMenuUrlFromName
  try {
    // No fallback domain, no global/cached values, no previous result reuse
    const menuResult = await findMenuUrlFromName({
      name,
      city,
      state,
      debug: true
    });
    console.log('findMenuUrlFromName result:');
    console.log(menuResult);
    // 5. If found, call menu scraper (optional, not run by default)
    // if (menuResult && menuResult.found && menuResult.url) {
    //   const scrapeResult = await scrapeMenu(menuResult.url);
    //   console.log('scrapeMenu result:', scrapeResult);
    // }
  } catch (err) {
    console.log('findMenuUrlFromName error:', err.message || err);
  }
})();
