// backend/scripts/singleRestaurantTest.cjs
// Direct test for The Olde Mecklenburg Brewery

const path = require('path');
const { findMenuUrlFromName } = require('../agents/findMenuUrlFromName.js');
const domainFinder = require(path.resolve(__dirname, '../../services/domainFinder.js'));
const menuScraper = require(path.resolve(__dirname, '../../menu-ingestion/services/menuScraper.js'));

const args = process.argv.slice(2);
const name = args[0] || 'Fig Tree';
const city = args[1] || 'Charlotte';
const state = args[2] || 'NC';

// Pure CommonJS async wrapper
(async () => {
  try {
    const domainResult = await domainFinder.findDomain({ name, city, state });
    console.log('DomainFinder result:');
    console.log('  domain:', domainResult.domain || domainResult);
    console.log('  types:', domainResult.types || 'N/A');
  } catch (err) {
    console.log('DomainFinder error:', err.message || err);
  }

  try {
    const menuResult = await findMenuUrlFromName({
      name,
      city,
      state,
      debug: true
    });
    console.log('findMenuUrlFromName result:');
    console.log(menuResult);
    if (menuResult && menuResult.found && menuResult.url) {
      try {
        const items = await menuScraper.scrapeMenu(menuResult.url);
        const count = Array.isArray(items) ? items.length : 0;
        console.log('  Menu items extracted:', count);
        console.log(JSON.stringify(items, null, 2));
      } catch (err) {
        console.log('  Menu scraper error:', err.message || err);
      }
    }
  } catch (err) {
    console.log('findMenuUrlFromName error:', err.message || err);
  }
})();
