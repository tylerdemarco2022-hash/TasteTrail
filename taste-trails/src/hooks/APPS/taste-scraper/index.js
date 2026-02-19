const restaurants = require("./config");
const scrapeRestaurant = require("./scraper");
const saveToFile = require("./save");

async function run() {
  for (const restaurant of restaurants) {
    console.log(`Scraping ${restaurant.name}...`);

    try {
      const structuredMenu = await scrapeRestaurant(restaurant);

      saveToFile(restaurant.name, structuredMenu);

      console.log(`Finished ${restaurant.name}`);
    } catch (e) {
      console.error(`Error scraping ${restaurant.name}:`, e && e.message ? e.message : String(e));
    }
  }
}

run();
