const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { parseMenuWithAI } = require('./aiParser');

const restaurants = [
  {
    name: 'Stir_Charlotte',
    url: 'https://www.stircharlotte.com/menus',
    selectors: ['menu-item', '[class*="menu"]', 'h3', 'h4', 'h2']
  },
  {
    name: 'La_Belle_Helene',
    url: 'https://www.labellehelenerestaurant.com/le-menu/#dinner',
    selectors: ['menu-item', '[class*="menu"]', 'h3', 'h2']
  },
  {
    name: 'Restaurant_Constance',
    url: 'https://restaurantconstance.com/food-menu',
    selectors: ['menu-item', '[class*="menu"]', 'h3', 'h4']
  },
  {
    name: 'Fahrenheit_Charlotte',
    url: 'https://fahrenheitrestaurants.com/charlotte-menu/',
    selectors: ['menu-item', '[class*="menu"]', 'h3']
  }
];

async function scrapeRestaurant(restaurant) {
  console.log(`\n📍 Scraping ${restaurant.name} from ${restaurant.url}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto(restaurant.url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for content to load
    await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));

    // Extract text content from entire page
    const rawText = await page.evaluate(() => document.body.innerText);

    // Save raw text
    const rawFilePath = path.join(__dirname, `${restaurant.name}_raw.txt`);
    fs.writeFileSync(rawFilePath, rawText);
    console.log(`✓ Saved raw text to ${restaurant.name}_raw.txt`);

    return rawText;
  } catch (error) {
    console.error(`Error scraping ${restaurant.name}:`, error.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  console.log('🍽️  Starting restaurant scraper for new locations...\n');

  for (const restaurant of restaurants) {
    const rawText = await scrapeRestaurant(restaurant);
    
    if (rawText) {
      console.log(`✓ Successfully scraped ${restaurant.name}`);
    } else {
      console.log(`✗ Failed to scrape ${restaurant.name}`);
    }
  }

  console.log('\n✅ Scraping complete! Raw text files saved.');
}

main().catch(console.error);
