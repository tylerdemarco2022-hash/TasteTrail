// backend/scripts/singleRestaurantTest.cjs
// Direct test for The Olde Mecklenburg Brewery

const path = require('path');
import { findMenuUrlFromName } from '../agents/findMenuUrlFromName.js';
const domainFinder = require(path.resolve(__dirname, '../../services/domainFinder.js'));
const menuScraper = require(path.resolve(__dirname, '../../menu-ingestion/services/menuScraper.js'));

const name = 'The Olde Mecklenburg Brewery';
const city = 'Charlotte';
const state = 'NC';

// Use ES module import for findMenuUrlFromName
(async () => {
  // 3. Run domainFinder directly
  try {
    const domainResult = await domainFinder.findDomain({ name, city, state });
    console.log('DomainFinder result:');
    console.log('  domain:', domainResult.domain || domainResult);
    console.log('  types:', domainResult.types || 'N/A');
  } catch (err) {
    console.log('DomainFinder error:', err.message || err);
  }

  // 4. Run findMenuUrlFromName
  try {
    const menuResult = await findMenuUrlFromName({
      name,
      city,
      state,
      debug: true
    });
    console.log('findMenuUrlFromName result:');
    console.log(menuResult);
    // 5. If found, call menu scraper
    if (menuResult && menuResult.found && menuResult.url) {
      try {
        const items = await menuScraper.scrapeMenu(url);
        const count = Array.isArray(items) ? items.length : 0;
        console.log('  Menu items extracted:', count);
      } catch (err) {
        console.log('  Menu scraper error:', err.message || err);
      }
    }
  } catch (err) {
    console.log('findMenuUrlFromName error:', err.message || err);
  }
})();
