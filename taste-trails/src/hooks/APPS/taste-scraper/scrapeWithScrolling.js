const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const restaurants = [
  {
    name: 'Restaurant_Constance',
    url: 'https://restaurantconstance.com/food-menu',
  },
  {
    name: 'Fahrenheit_Charlotte',
    url: 'https://fahrenheitrestaurants.com/charlotte-menu/',
  }
];

async function scrapeWithScrolling(restaurant) {
  console.log(`\n📍 Scraping ${restaurant.name} with scrolling...`);
  
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

    // Wait for initial content
    await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));

    // Scroll to load all dynamic content
    let prevHeight = 0;
    for (let i = 0; i < 20; i++) {
      const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
      if (bodyHeight === prevHeight) break;
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
      prevHeight = bodyHeight;
    }

    // Scroll back to top to ensure all content is loaded
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

    // Extract full content
    const rawText = await page.evaluate(() => document.body.innerText);
    
    // Save file
    const fileName = `${restaurant.name}_raw_scrolled.txt`;
    fs.writeFileSync(path.join(__dirname, fileName), rawText);
    console.log(`✓ Scraped ${restaurant.name} (${rawText.length} chars)`);

    return rawText;
  } catch (error) {
    console.error(`Error scraping ${restaurant.name}:`, error.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  console.log('🍽️  Advanced scraper with scrolling...\n');

  for (const restaurant of restaurants) {
    await scrapeWithScrolling(restaurant);
  }

  console.log('\n✅ Complete!');
}

main().catch(console.error);
