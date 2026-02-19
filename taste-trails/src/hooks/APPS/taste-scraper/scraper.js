const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const parseMenu = require("./aiParser");

async function scrapeRestaurant(restaurant) {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Set realistic user agent and viewport
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto(restaurant.url, {
    waitUntil: "networkidle2",
    timeout: 60000
  });

  // Wait for specific menu selectors to render (multiple attempts)
  let rawText = '';
  const menuSelectors = [
    '.menu-item', '.menu-items', '[class*="menu"]', '[class*="item"]',
    '[role="listitem"]', 'article', '.product', '[data-menu]'
  ];
  
  // Extended wait for dynamic content with retry logic
  let attempts = 0;
  const maxAttempts = 8;
  while (attempts < maxAttempts) {
    // Wait incrementally
    await new Promise(r => setTimeout(r, 1000));
    
    rawText = await page.evaluate(() => document.body.innerText);
    
    // Check if we likely have menu content (more than just nav/footer)
    const lines = rawText.split('\n').filter(l => l.trim().length > 0);
    if (lines.length > 30) {
      // Check for likely menu keywords
      const hasMenuKeywords = rawText.toLowerCase().match(/menu|item|entree|appetizer|dessert|drink|wine|cocktail|chef|special/);
      if (hasMenuKeywords) break;
    }
    attempts++;
  }

  console.log(`Scraped after ${attempts + 1} attempts (${rawText.length} chars)`);

  // Debug: save raw text
  const debugPath = path.join(__dirname, `${restaurant.name.replace(/\s/g, "_")}_raw.txt`);
  fs.writeFileSync(debugPath, rawText);
  console.log(`Raw text saved to ${debugPath}`);

  await browser.close();

  const structuredMenu = await parseMenu(rawText);

  return structuredMenu;
}

module.exports = scrapeRestaurant;
