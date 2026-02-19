const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

class RestaurantScraper {
  
  async scrapeSeaGrill() {
    console.log('Scraping Sea Grill...');
    const browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    try {
      // Go to the main menu pages and combine
      const menusToScrape = [
        { url: 'https://www.seagrillnc.com/diner-menu', name: 'DINNER' },
        { url: 'https://www.seagrillnc.com/signature-dishes', name: 'SIGNATURE' },
        { url: 'https://www.seagrillnc.com/cocktails-menu', name: 'COCKTAILS' },
        { url: 'https://www.seagrillnc.com/kids-menu', name: 'KIDS' }
      ];
      
      let combinedText = '';
      
      for (const menu of menusToScrape) {
        console.log(`  - ${menu.url}`);
        
        await page.goto(menu.url, {
          waitUntil: "networkidle2",
          timeout: 60000
        });
        
        // Wait for content with multiple waits
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 1000));
          
          const text = await page.evaluate(() => document.body.innerText);
          if (text.length > 500) break;
        }
        
        const menuText = await page.evaluate(() => document.body.innerText);
        combinedText += `\n\n=== ${menu.name} MENU ===\n\n${menuText}`;
      }
      
      // Save combined
      const outputPath = path.join(__dirname, 'Sea_Grill_Diner_Menu_raw.txt');
      fs.writeFileSync(outputPath, combinedText);
      console.log(`Saved to ${outputPath}`);
      
      return combinedText;
      
    } finally {
      await browser.close();
    }
  }
  
  async scrapeMamaRicottas() {
    console.log('Scraping Mama Ricotta\'s...');
    const browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    try {
      const url = 'https://www.mamaricottaspizza.com/';
      console.log(`  - ${url}`);
      
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 60000
      });
      
      // Wait for content
      for (let i = 0; i < 8; i++) {
        const text = await page.evaluate(() => document.body.innerText);
        if (text.toLowerCase().includes('menu') || text.toLowerCase().includes('pizza')) {
          break;
        }
        await new Promise(r => setTimeout(r, 1000));
      }
      
      const rawText = await page.evaluate(() => document.body.innerText);
      
      // Save
      const outputPath = path.join(__dirname, 'Mama_Ricotta_s_Menu_raw.txt');
      fs.writeFileSync(outputPath, rawText);
      console.log(`Saved to ${outputPath}`);
      
      return rawText;
      
    } finally {
      await browser.close();
    }
  }
}

// Main
(async () => {
  const scraper = new RestaurantScraper();
  
  try {
    await scraper.scrapeSeaGrill();
    console.log('');
    await scraper.scrapeMamaRicottas();
    
    console.log('\nRe-scraping complete! Now run the AI parser on the raw files.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
