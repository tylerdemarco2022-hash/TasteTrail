const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../services/logger');

const PDF_CONTENT_TYPES = ['application/pdf'];

async function fetchUrlHead(url) {
  try {
    const res = await axios.head(url, { timeout: 10000, maxRedirects: 5 });
    return res.headers['content-type'] || '';
  } catch (err) {
    return '';
  }
}

function parseHtmlMenu(html, restaurant) {
  const $ = cheerio.load(html);
  const menuSections = [];

  // Heuristic: headings followed by lists or groups
  $('h1,h2,h3,h4').each((i, el) => {
    const section = $(el).text().trim();
    if (!section) return;
    const items = [];
    let sib = $(el).next();
    while (sib && sib.length && !/^h[1-4]$/i.test(sib[0].name)) {
      if (sib.is('ul') || sib.is('ol')) {
        sib.find('li').each((j, li) => {
          const name = $(li).find('.item-name').text().trim() || $(li).text().trim();
          if (name && !/view cart/i.test(name)) {
            items.push({ name, description: '', price: null });
          }
        });
      }
      if (sib.is('p') || sib.is('div')) {
        const text = sib.text().trim();
        if (text && /\$|\d{1,3}\.\d{2}/.test(text)) {
          // crude split into lines
          text.split('\n').forEach(line => {
            const l = line.trim();
            if (l && !/view cart/i.test(l)) items.push({ name: l, description: '', price: null });
          });
        }
      }
      sib = sib.next();
    }
    if (items.length) menuSections.push({ section, items });
  });

  // If no headings found, try to detect common menu containers
  if (!menuSections.length) {
    const items = [];
    $('li').each((i, li) => {
      const text = $(li).text().trim();
      if (text && !/view cart/i.test(text)) items.push({ name: text, description: '', price: null });
    });
    if (items.length) menuSections.push({ section: 'Menu', items });
  }

  return { restaurant, menu_sections: menuSections };
}

async function menuScraperAgent(restaurant) {
  const out = { restaurant: restaurant.name || null, menu_sections: [] };
  if (!restaurant.website) return out;
  const website = restaurant.website;

  try {
    const contentType = await fetchUrlHead(website);
    if (PDF_CONTENT_TYPES.some(ct => contentType.includes(ct))) {
      // PDF menu: store URL as PDF reference
      return { restaurant: restaurant.name, menu_sections: [{ section: 'PDF Menu', items: [{ name: website, description: 'PDF menu URL', price: null }] }] };
    }

    // Use puppeteer for robust rendering
    const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'], headless: true });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    await page.goto(website, { waitUntil: 'domcontentloaded' });

    // wait for possible menu keywords
    await page.waitForTimeout(1500);
    const html = await page.content();
    await browser.close();

    // detect embedded ordering providers
    if (/toasttab|squareup|ordernow|menuv2|openmenu|menu|menupages|chownow/i.test(html)) {
      // try to detect embedded menu iframe src
      const $ = cheerio.load(html);
      const iframe = $('iframe[src*="toast"], iframe[src*="squareup"], iframe[src*="chownow"], iframe[src*="openmenu"]').attr('src');
      if (iframe) {
        return { restaurant: restaurant.name, menu_sections: [{ section: 'Embedded Ordering', items: [{ name: iframe, description: 'embedded ordering iframe', price: null }] }] };
      }
    }

    const parsed = parseHtmlMenu(html, restaurant.name);
    return parsed;
  } catch (err) {
    logger.warn('menuScraperAgent failed for %s: %s', restaurant.website || restaurant.name, err.message);
    return out;
  }
}

module.exports = menuScraperAgent;
