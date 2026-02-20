const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeAndSaveMenu(url, outFile = 'menu_debug_output.html') {
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'], headless: true });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(30000);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await new Promise(resolve => setTimeout(resolve, 2000));
  const html = await page.content();
  await browser.close();
  fs.writeFileSync(outFile, html);
  console.log(`Saved HTML to ${outFile}`);
}

// Change the URL below to any menu page you want to debug
scrapeAndSaveMenu('https://www.131-main.com/menus/dinner-fall/', 'debug_menu_131_main.html');
