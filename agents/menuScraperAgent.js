import puppeteer from 'puppeteer';
import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../services/logger.js';

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

  // Heuristic 1: headings followed by lists or groups
  $('h1,h2,h3,h4').each((i, el) => {
    const section = $(el).text().trim();
    if (!section) return;
    const items = [];
    let sib = $(el).next();
    while (sib && sib.length && !/^h[1-4]$/i.test(sib[0].name)) {
      // List items
      if (sib.is('ul') || sib.is('ol')) {
        sib.find('li').each((j, li) => {
          const name = $(li).find('.item-name').text().trim() || $(li).text().trim();
          const priceMatch = name.match(/\$\d+[\d.,]*/);
          const price = priceMatch ? priceMatch[0] : null;
          if (name && !/view cart/i.test(name)) {
            items.push({ name, description: '', price });
          }
        });
      }
      // Table rows
      if (sib.is('table')) {
        sib.find('tr').each((j, tr) => {
          const tds = $(tr).find('td');
          if (tds.length >= 2) {
            const name = $(tds[0]).text().trim();
            const price = $(tds[1]).text().trim().match(/\$?\d+[\d.,]*/);
            const desc = tds.length > 2 ? $(tds[2]).text().trim() : '';
            if (name && !/view cart/i.test(name)) {
              items.push({ name, description: desc, price: price ? price[0] : null });
            }
          }
        });
      }
      // Card/grid style (divs with menu-item or similar)
      if (sib.is('div')) {
        sib.find('.menu-item, .item, .menu_card, .card').each((j, card) => {
          const name = $(card).find('.item-name, .menu-item-title, .title').text().trim() || $(card).text().trim();
          const desc = $(card).find('.item-description, .desc, .description').text().trim();
          const price = $(card).find('.item-price, .price').text().trim().match(/\$?\d+[\d.,]*/);
          if (name && !/view cart/i.test(name)) {
            items.push({ name, description: desc, price: price ? price[0] : null });
          }
        });
      }
      // Paragraphs and generic divs with price
      if (sib.is('p') || sib.is('div')) {
        const text = sib.text().trim();
        if (text && /\$|\d{1,3}\.\d{2}/.test(text)) {
          text.split('\n').forEach(line => {
            const l = line.trim();
            const price = l.match(/\$?\d+[\d.,]*/);
            if (l && !/view cart/i.test(l)) items.push({ name: l, description: '', price: price ? price[0] : null });
          });
        }
      }
      sib = sib.next();
    }
    if (items.length) menuSections.push({ section, items });
  });

  // Heuristic 2: tables with menu data (no headings)
  if (!menuSections.length) {
    $('table').each((i, table) => {
      const section = $(table).prev('h1,h2,h3,h4').text().trim() || 'Menu';
      const items = [];
      $(table).find('tr').each((j, tr) => {
        const tds = $(tr).find('td');
        if (tds.length >= 2) {
          const name = $(tds[0]).text().trim();
          const price = $(tds[1]).text().trim().match(/\$?\d+[\d.,]*/);
          const desc = tds.length > 2 ? $(tds[2]).text().trim() : '';
          if (name && !/view cart/i.test(name)) {
            items.push({ name, description: desc, price: price ? price[0] : null });
          }
        }
      });
      if (items.length) menuSections.push({ section, items });
    });
  }

  // Heuristic 3: card/grid style menus (no headings)
  if (!menuSections.length) {
    const items = [];
    $('.menu-item, .item, .menu_card, .card').each((i, card) => {
      const name = $(card).find('.item-name, .menu-item-title, .title').text().trim() || $(card).text().trim();
      const desc = $(card).find('.item-description, .desc, .description').text().trim();
      const price = $(card).find('.item-price, .price').text().trim().match(/\$?\d+[\d.,]*/);
      if (name && !/view cart/i.test(name)) {
        items.push({ name, description: desc, price: price ? price[0] : null });
      }
    });
    if (items.length) menuSections.push({ section: 'Menu', items });
  }

  // Heuristic 4: fallback to all <li> elements
  if (!menuSections.length) {
    const items = [];
    $('li').each((i, li) => {
      const text = $(li).text().trim();
      const price = text.match(/\$?\d+[\d.,]*/);
      if (text && !/view cart/i.test(text)) items.push({ name: text, description: '', price: price ? price[0] : null });
    });
    if (items.length) menuSections.push({ section: 'Menu', items });
  }

  return { restaurant, menu_sections: menuSections };
}

async function menuScraperAgent(restaurant) {
      // Will log all network requests to hunt for menu data
      const networkLog = [];
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
    // Log all network requests to hunt for menu data
    page.on('request', req => {
      networkLog.push({ url: req.url(), resourceType: req.resourceType(), method: req.method() });
    });
    page.on('response', async res => {
      try {
        const ct = res.headers()['content-type'] || '';
        if (ct.includes('json')) {
          const body = await res.text();
          networkLog.push({ url: res.url(), type: 'json', body: body.slice(0, 1000) });
        }
      } catch (e) {}
    });
    page.setDefaultNavigationTimeout(30000);
    await page.goto(website, { waitUntil: 'domcontentloaded' });

    // Wait for menu content to appear (h3 headings or menu-related selectors)
    try {
      await page.waitForSelector('h3, .menu, .menu-section, .menu-block, .menu-list', { timeout: 8000 });
    } catch (e) {
      // fallback: still try to extract
    }
    await new Promise(r => setTimeout(r, 1000));
    const html = await page.content();
    // Enhanced extraction for 131 Main: target <h3> and following <p> elements in the main menu area
    const $ = cheerio.load(html);
    let menuSections = [];
    // Find the main menu area by looking for the DINNER menu header
    let foundMenuHeader = false;
    $('h1, h2, h3').each((i, el) => {
      const txt = $(el).text().toLowerCase();
      if (txt.includes('dinner') && txt.includes('menu')) {
        foundMenuHeader = true;
        return false; // break
      }
    });
    if (foundMenuHeader) {
      // After the DINNER menu header, extract all <h3> and their following <p> blocks
      let startExtracting = false;
      let currentSection = null;
      let currentItems = [];
      $("body").find('*').each((i, el) => {
        if (el.tagName && /^h[1-3]$/i.test(el.tagName)) {
          const txt = $(el).text().toLowerCase();
          if (txt.includes('dinner') && txt.includes('menu')) {
            startExtracting = true;
            return;
          }
          if (startExtracting && el.tagName === 'h3') {
            // Save previous section
            if (currentSection && currentItems.length) {
              menuSections.push({ section: currentSection, items: currentItems });
            }
            currentSection = $(el).text().trim();
            currentItems = [];
          }
        } else if (startExtracting && el.tagName === 'p' && currentSection) {
          // Parse <p> block for menu items
          const htmlLines = $(el).html().split(/<br\s*\/?>(\s*)?/i);
          htmlLines.forEach(line => {
            const line$ = cheerio.load(line);
            const strong = line$('strong').first();
            let name = strong.text().trim();
            let rest = line$.root().text().replace(name, '').trim();
            // Price is usually at the end
            let priceMatch = rest.match(/(\$?\d+[\d.,]*)\s*$/);
            let price = priceMatch ? priceMatch[1] : null;
            if (price) rest = rest.replace(price, '').trim();
            if (name) {
              currentItems.push({ name, description: rest, price });
            }
          });
        } else if (startExtracting && el.tagName && /^h[1-3]$/i.test(el.tagName) && !$(el).text().toLowerCase().includes('dinner')) {
          // End extraction if we hit a new unrelated section
          if (currentSection && currentItems.length) {
            menuSections.push({ section: currentSection, items: currentItems });
          }
          currentSection = null;
          currentItems = [];
          startExtracting = false;
        }
      });
      // Push last section
      if (currentSection && currentItems.length) {
        menuSections.push({ section: currentSection, items: currentItems });
      }
    }
    // If nothing found, fallback to original parser
    if (!menuSections.length) {
      // detect embedded ordering providers
      if (/toasttab|squareup|ordernow|menuv2|openmenu|menu|menupages|chownow/i.test(html)) {
        const iframe = $('iframe[src*="toast"], iframe[src*="squareup"], iframe[src*="chownow"], iframe[src*="openmenu"]').attr('src');
        if (iframe) {
          await browser.close();
          return { restaurant: restaurant.name, menu_sections: [{ section: 'Embedded Ordering', items: [{ name: iframe, description: 'embedded ordering iframe', price: null }] }] };
        }
      }
      const parsed = parseHtmlMenu(html, restaurant.name);
      menuSections = parsed.menu_sections;
    }

    // If still nothing, fallback to original parser
    if (!menuSections.length) {
      // detect embedded ordering providers
      if (/toasttab|squareup|ordernow|menuv2|openmenu|menu|menupages|chownow/i.test(html)) {
        const iframe = $('iframe[src*="toast"], iframe[src*="squareup"], iframe[src*="chownow"], iframe[src*="openmenu"]').attr('src');
        if (iframe) {
          await browser.close();
          return { restaurant: restaurant.name, menu_sections: [{ section: 'Embedded Ordering', items: [{ name: iframe, description: 'embedded ordering iframe', price: null }] }] };
        }
      }
      const parsed = parseHtmlMenu(html, restaurant.name);
      menuSections = parsed.menu_sections;
    }

    // If still nothing, try OpenAI extraction as fallback
    if (!menuSections.length && process.env.OPENAI_API_KEY) {
      try {
        const openaiModule = await import('openai');
        const { Configuration, OpenAIApi } = openaiModule;
        const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
        const openai = new OpenAIApi(configuration);
        const prompt = `You are an expert at extracting restaurant menus from HTML. The following HTML is from the website for the restaurant '${restaurant.name}'. Find and extract ONLY the dinner menu (not lunch, brunch, or drinks). Return JSON in the format: [{section: string, items: [{name: string, description: string, price: string}]}].\nIf you cannot find a dinner menu, return an empty array.\nHTML:\n${html.slice(0, 12000)}`;
        const completion = await openai.createChatCompletion({
          model: 'gpt-4-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that extracts restaurant menus from HTML.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 2000,
          temperature: 0.2
        });
        const text = completion.data.choices[0].message.content;
        let aiMenu = [];
        try { aiMenu = JSON.parse(text); } catch (e) {}
        if (Array.isArray(aiMenu) && aiMenu.length) {
          menuSections = aiMenu;
        }
      } catch (e) {
        // ignore OpenAI errors
      }
    }

    // If still nothing, dump HTML to file for debugging
    if (!menuSections.length) {
      const fs = await import('fs');
      const safeName = (restaurant.name || 'menu').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      fs.writeFileSync(`debug_menu_${safeName}.html`, html);
    }
    // Save network log for debugging
    if (!menuSections.length && networkLog.length) {
      const fs = await import('fs');
      const safeName = (restaurant.name || 'menu').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      fs.writeFileSync(`networklog_${safeName}.json`, JSON.stringify(networkLog, null, 2));
    }
    await browser.close();
    return { restaurant: restaurant.name, menu_sections: menuSections };
  } catch (err) {
    logger.warn(`menuScraperAgent failed for ${restaurant.website || restaurant.name}: ${err.message}`);
    return out;
  }
}

export default menuScraperAgent;

// CLI support: node menuScraperAgent.js <url>
if (process.argv[1] && process.argv[1].endsWith('menuScraperAgent.js')) {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node menuScraperAgent.js <url>');
    process.exit(1);
  }
  (async () => {
    const result = await menuScraperAgent({ name: 'CLI', website: url });
    console.log(JSON.stringify(result, null, 2));
  })();
}
