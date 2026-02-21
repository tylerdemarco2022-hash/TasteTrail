// GraphQL Menu Adapter
async function graphqlMenuAdapter({ graphqlEndpoint, query, variables, headers }) {
  try {
    const res = await axios.post(graphqlEndpoint, { query, variables }, { headers });
    const data = res.data.data || res.data;
    let categories = [];
    let items = [];
    // Try to find categories/items/products in response
    for (const k of Object.keys(data)) {
      if (Array.isArray(data[k]) && k.toLowerCase().includes('categor')) categories = data[k];
      if (Array.isArray(data[k]) && (k.toLowerCase().includes('item') || k.toLowerCase().includes('product'))) items = data[k];
    }
    // Normalize price field
    function normalizePrice(val) {
      if (typeof val === 'string') {
        const match = val.match(/\$?\d+[\d.,]*/);
        return match ? match[0] : null;
      }
      if (typeof val === 'number') return `$${val}`;
      return null;
    }
    // Build sections from categories
    const sections = categories.map(cat => {
      const catItems = items.filter(item => item.categoryId === cat.id);
      const allItems = catItems.map(obj => ({
        name: obj.name,
        price: normalizePrice(obj.price),
        description: obj.description || ''
      }));
      return {
        name: cat.name,
        items: allItems
      };
    });
    return { sections };
  } catch (err) {
    return { sections: [] };
  }
}
// Domain eligibility gate
function isEligibleRestaurantDomain(domain, homepageHtml) {
  const rejectKeywords = [
    'topgolf', 'greatwolf', 'resort', 'hotel', 'waterpark', 'themepark',
    'entertainment', 'lodge', 'casino', 'stadium', 'arena'
  ];
  const requireKeywords = ['menu', 'dining', 'food', 'restaurant', 'eat'];
  domain = domain.toLowerCase();
  for (const kw of rejectKeywords) {
    if (domain.includes(kw)) {
      return {
        eligible: false,
        reason: `Domain contains rejected keyword: ${kw}`
      };
    }
  }
  if (homepageHtml) {
    const htmlLower = homepageHtml.toLowerCase();
    if (!requireKeywords.some(kw => htmlLower.includes(kw))) {
      return {
        eligible: false,
        reason: 'Homepage missing required food keywords'
      };
    }
  }
  return { eligible: true };
}
import axios from 'axios';
import logger from '../services/logger.js';
import * as pdfParseModule from 'pdf-parse';
import { PDFParse } from 'pdf-parse';
import { Buffer } from 'buffer';

// Puppeteer will be dynamically imported below

const PDF_CONTENT_TYPES = ['application/pdf'];

async function fetchUrlHead(url) {
  try {
    const res = await axios.head(url, { timeout: 10000, maxRedirects: 5 });
    return res.headers['content-type'] || '';
  } catch (err) {
    return '';
  }
}

// ModernLayoutStrategy: handles CSR, visual headings, dynamic wait
class ModernLayoutStrategy {
  constructor(page) {
    this.page = page;
  }
  async waitForMenuKeywords() {
    const menuKeywords = ["Appetizers", "Entrees", "Price", "Menu", "Dinner", "Lunch", "Brunch", "Dessert", "Starters", "Salads", "Sides", "Drinks", "Cocktails", "Wine", "Beer"];
    let lastLength = 0;
    let stableCount = 0;
    let foundMenuKeyword = false;
    for (let i = 0; i < 40; i++) { // up to 20s
      if (!this.page || this.page.isClosed() || !this.page.mainFrame().isDetached()) {
        // Re-acquire main frame if detached
        this.page = await this.page.browser().newPage();
      }
      try {
        const innerText = await this.page.evaluate(() => document.body.innerText);
        const length = innerText.length;
        if (length === lastLength) {
          stableCount++;
        } else {
          stableCount = 0;
        }
        lastLength = length;
        foundMenuKeyword = menuKeywords.some(k => innerText.includes(k));
        if (stableCount >= 3 && foundMenuKeyword) break;
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        if (err.message && (err.message.includes('detached') || err.message.includes('context'))) {
          // Try again on main frame
          this.page = await this.page.browser().newPage();
        } else {
          throw err;
        }
      }
    }
  }
  async extractMenuSections() {
    try {
      await this.waitForMenuKeywords();
      const html = await this.page.content();
      // Place all extraction logic here
      // (Move any loose code from class body into this method)
    } catch (err) {
      // Error handling
    }
  }
}

// Top-level parseHtmlMenu function
function parseHtmlMenu(html, restaurant) {
  const $ = cheerio.load(html);
  const menuSections = [];

  // Heuristic 1: headings followed by lists or groups
  let headingEls = $('h1,h2,h3,h4');
  if (!headingEls.length) {
    // Fallback: div/span with class 'title', 'heading', 'category' and high font-weight
    headingEls = $('div[class*="title"],div[class*="heading"],div[class*="category"],span[class*="title"],span[class*="heading"],span[class*="category"]').filter(function() {
      const el = $(this);
      const style = el.css('font-weight');
      // Consider font-weight >= 500 as bold
      return style && (parseInt(style) >= 500 || style === 'bold');
    });
  }
  headingEls.each((i, el) => {
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

async function extractPdfMenu(url, restaurantName) {
  // Download PDF, convert to buffer, extract text, classify menu
  // Modular upscale PDF menu extraction
  function preprocessPdfLines(pdfText) {
    // Split text into lines, trim, filter empty
    let lines = pdfText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const priceRegex = /\d{1,3}(\.\d{2})?/g;
    const processedLines = [];
    for (let line of lines) {
      // Clean numeric noise: ignore page numbers, years
      if (/^\d{1,2}\s*$/.test(line)) continue; // page numbers
      if (/^\d{4}$/.test(line)) continue; // years
      // If line contains 2+ price patterns, split
      const prices = [...line.matchAll(priceRegex)];
      if (prices.length > 1) {
        // Split line at price anchors
        let segments = [];
        let lastIdx = 0;
        for (let i = 0; i < prices.length; i++) {
          const priceMatch = prices[i];
          const priceIdx = priceMatch.index;
          // Find start of segment
          let segment = line.slice(lastIdx, priceIdx + priceMatch[0].length).trim();
          segments.push(segment);
          lastIdx = priceIdx + priceMatch[0].length;
        }
        // Add debug log for column split
        logger.info(`[PDF] COLUMN_SPLIT_APPLIED: ${segments.join(' | ')}`);
        processedLines.push(...segments);
        continue;
      }
      processedLines.push(line);
    }
    return processedLines;
  }

  function extractStructuredMenu(pdfText) {
    const lines = preprocessPdfLines(pdfText);
    const sections = [];
    let currentSection = null;
    let items = [];
    let pendingItemName = null;
    let modifierMode = false;
    let modifiers = [];
    const ignorePatterns = [
      /^\d{1,2}\s*$/, // page numbers
      /^dinner menu$/i,
      /^the fig tree/i,
      /^charlotte, nc/i,
      /^\s*$/,
    ];
    const modifierTriggers = [
      /add/i,
      /additions/i,
      /enhancements/i,
      /with/i
    ];
    const proteinKeywords = [
      /steak/i,
      /duck/i,
      /salmon/i,
      /chicken/i,
      /shrimp/i,
      /filet/i,
      /pork/i,
      /lamb/i,
      /mignon/i,
      /bass/i,
      /octopus/i,
      /veal/i,
      /elk/i,
      /scallop/i,
      /calamari/i,
      /foie/i,
      /mussels/i,
      /escargot/i,
      /lobster/i,
      /cheese plate/i,
      /cheese/i,
      /egg/i,
      /fish/i
    ];
    let lastValidPrimary = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (ignorePatterns.some(pat => pat.test(line))) continue;
      if (line.length < 3) continue;
      // Modifier trigger detection
      if (modifierTriggers.some(pat => pat.test(line))) {
        modifierMode = true;
        modifiers = [];
        lastValidPrimary = false;
        continue;
      }
      // DETECT CATEGORY HEADER: ALL CAPS, no numbers, >3 chars
      if (
        /^[A-Z\s]+$/.test(line) &&
        line.length > 3 &&
        !/\d/.test(line)
      ) {
        // Close previous section if exists
        if (currentSection !== null) {
          logger.info(`[PDF] SECTION_CREATED: ${currentSection}`);
          logger.info(`[PDF] SECTION_ITEM_COUNT: ${items.length}`);
          sections.push({ section: currentSection, items });
        }
        logger.info(`[PDF] DETECTED_CATEGORY: ${line}`);
        currentSection = line;
        items = [];
        pendingItemName = null;
        modifierMode = false;
        modifiers = [];
        lastValidPrimary = false;
        continue;
      }
      // DETECT ITEM LINE: ends with number, dotted leader pricing
      let itemMatch = line.match(/^(.+?)\s+(\d{1,3}(\.\d{2})?)$/);
      if (!itemMatch) {
        itemMatch = line.match(/^(.+?)\.*\s+(\d{1,3}(\.\d{2})?)$/);
      }
      if (itemMatch) {
        const name = itemMatch[1].replace(/\.+$/, '').trim();
        const price = Number(itemMatch[2]);
        const wordCount = name.split(/\s+/).length;
        const isProtein = proteinKeywords.some(pat => pat.test(name));
        // Primary validation
        if (wordCount >= 3 || price >= 8 || isProtein) {
          logger.info(`[PDF] VALID_PRIMARY_CONFIRMED: ${name} | ${price}`);
          items.push({ name, description: '', price, modifiers: [...modifiers] });
          modifiers = [];
          pendingItemName = null;
          modifierMode = false;
          lastValidPrimary = true;
          continue;
        }
        // Modifier detection: short line (<3 words) and price ≤ 5
        if (wordCount < 3 && price <= 5) {
          logger.info(`[PDF] PRIMARY_REJECTED: ${name} | ${price}`);
          // Only attach as modifier if lastValidPrimary exists
          if (lastValidPrimary) {
            logger.info(`[PDF] MODIFIER_DETECTED: ${name} | ${price}`);
            modifiers.push({ name, price });
          } else {
            logger.info(`[PDF] MODIFIER_DETECTED: ${name} | ${price} (discarded, no valid primary)`);
          }
          continue;
        }
        // If not valid primary or modifier, reject
        logger.info(`[PDF] PRIMARY_REJECTED: ${name} | ${price}`);
        continue;
      }
      // DETECT MULTILINE PRICE: line is only a number, not a page/section/wine year
      if (/^\d{1,3}(\.\d{2})?$/.test(line)) {
        if (pendingItemName && !/^\d{4}$/.test(line)) {
          const wordCount = pendingItemName.split(/\s+/).length;
          const isProtein = proteinKeywords.some(pat => pat.test(pendingItemName));
          if (wordCount >= 3 || Number(line) >= 8 || isProtein) {
            logger.info(`[PDF] VALID_PRIMARY_CONFIRMED: ${pendingItemName} | ${Number(line)}`);
            items.push({ name: pendingItemName, description: '', price: Number(line), modifiers: [...modifiers] });
            modifiers = [];
            pendingItemName = null;
            modifierMode = false;
            lastValidPrimary = true;
            continue;
          }
          if (wordCount < 3 && Number(line) <= 5) {
            logger.info(`[PDF] PRIMARY_REJECTED: ${pendingItemName} | ${Number(line)}`);
            if (lastValidPrimary) {
              logger.info(`[PDF] MODIFIER_DETECTED: ${pendingItemName} | ${Number(line)}`);
              modifiers.push({ name: pendingItemName, price: Number(line) });
            } else {
              logger.info(`[PDF] MODIFIER_DETECTED: ${pendingItemName} | ${Number(line)} (discarded, no valid primary)`);
            }
            pendingItemName = null;
            continue;
          }
          logger.info(`[PDF] PRIMARY_REJECTED: ${pendingItemName} | ${Number(line)}`);
          pendingItemName = null;
          continue;
        }
        continue;
      }
      // Ignore repeated footer/header text
      if (i > 0 && line === lines[i-1]) continue;
      // If not item, treat as description for last item
      if (items.length && !items[items.length-1].description) {
        items[items.length-1].description = line;
        pendingItemName = null;
      } else {
        pendingItemName = line;
      }
    }
    // Close last section
    if (currentSection !== null) {
      logger.info(`[PDF] SECTION_CREATED: ${currentSection}`);
      logger.info(`[PDF] SECTION_ITEM_COUNT: ${items.length}`);
      sections.push({ section: currentSection, items });
    }
    logger.info(`[PDF] TOTAL_SECTIONS: ${sections.length}`);
    sections.forEach(sec => logger.info(`[PDF] SECTION_ITEM_COUNT (${sec.section}): ${sec.items.length}`));
    return sections;
  }
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
    const buffer = Buffer.from(res.data);
    const parser = new PDFParse({ data: buffer });
    const pdfResult = await parser.getText();
    const pdfText = pdfResult.text || '';
    logger.info(`[PDF] ${restaurantName} PDF_TEXT_LENGTH: ${pdfText.length}`);
    // Use improved structured extraction
    const sections = extractStructuredMenu(pdfText);

    // Unified confidence scoring after structured extraction
    let primaryCount = 0;
    let modifierCount = 0;
    let rejectedCount = 0;
    let priceList = [];
    let categoryHeaderCount = 0;
    let sectionCount = sections.length;
    sections.forEach(sec => {
      if (/^[A-Z\s]+$/.test(sec.section) && sec.section.length > 3 && !/\d/.test(sec.section)) categoryHeaderCount++;
      sec.items.forEach(item => {
        if (item.modifiers && item.modifiers.length) modifierCount += item.modifiers.length;
        if (item.name && item.price !== undefined && item.price !== null) {
          primaryCount++;
          priceList.push(Number(item.price));
        }
        if (item.name && item.price === undefined) rejectedCount++;
      });
    });
    const avgPrice = priceList.length ? priceList.reduce((a,b) => a+b,0)/priceList.length : 0;
    const priceStddev = priceList.length > 1 ? Math.sqrt(priceList.map(p => Math.pow(p-avgPrice,2)).reduce((a,b)=>a+b,0)/priceList.length) : 0;
    const validPriceDistribution = priceList.length > 1 && priceStddev < 10;
    const modifierRatio = primaryCount ? modifierCount/primaryCount : 0;
    let confidence = 0;
    let breakdown = [];
    console.log("CONFIDENCE_INPUTS:", {
      sectionCount,
      primaryCount,
      modifierCount,
      prices: priceList,
      rejectedCount
    });
    if (primaryCount >= 20) { confidence += 30; breakdown.push('primaryCount>=20:+30'); }
    if (sectionCount >= 2) { confidence += 20; breakdown.push('sectionCount>=2:+20'); }
    if (validPriceDistribution) { confidence += 20; breakdown.push('validPriceDistribution:+20'); }
    if (modifierRatio < 0.3) { confidence += 10; breakdown.push('modifierRatio<0.3:+10'); }
    if (rejectedCount < 5) { confidence += 20; breakdown.push('rejectedCount<5:+20'); }
    confidence = Math.max(0, Math.min(100, confidence));
    console.log("FINAL_CONFIDENCE_RECALCULATED:", confidence);
    logger.info(`[HTML] ${restaurant.name} JS_RENDERED_CONFIDENCE_SCORE: ${confidence}`);
    return { restaurant: restaurantName, menu_sections: sections, confidence };
  } catch (err) {
    logger.warn(`[PDF] ${restaurantName} PDF extraction failed: ${err.message}`);
    return { restaurant: restaurantName, menu_sections: [] };
  }
}

async function menuScraperAgent(restaurant) {
                                                      // Network Interception Mode
                                                      async function networkInterceptionMode(page) {
                                                        let apiInterceptUsed = false;
                                                        let interceptedSections = [];
                                                        await page.setRequestInterception(true);
                                                        const interceptedJsons = [];
                                                        page.on('request', req => req.continue());
                                                        page.on('response', async res => {
                                                          const ct = res.headers()['content-type'] || '';
                                                          if (ct.includes('application/json')) {
                                                            try {
                                                              const body = await res.json();
                                                              interceptedJsons.push(body);
                                                            } catch (e) {}
                                                          }
                                                        });
                                                        await page.reload({ waitUntil: "networkidle2" });
                                                        await new Promise(r => setTimeout(r, 3000));
                                                        // Attempt structured reconstruction
                                                        for (const json of interceptedJsons) {
                                                          const keys = Object.keys(json);
                                                          let itemsArr = keys.find(k => Array.isArray(json[k]) && json[k].length > 0 && typeof json[k][0] === 'object');
                                                          if (itemsArr) {
                                                            const arr = json[itemsArr];
                                                            const hasPrice = arr.some(obj => obj.price || obj.amount);
                                                            const hasName = arr.some(obj => obj.name || obj.title);
                                                            if (hasPrice && hasName) {
                                                              apiInterceptUsed = true;
                                                              interceptedSections = [
                                                                {
                                                                  section: itemsArr,
                                                                  items: arr.map(obj => ({
                                                                    name: obj.name || obj.title || '',
                                                                    price: obj.price || obj.amount || '',
                                                                    description: obj.description || obj.desc || ''
                                                                  }))
                                                                }
                                                              ];
                                                              break;
                                                            }
                                                          }
                                                        }
                                                        return { apiInterceptUsed, interceptedSections };
                                                      }
                                                // Lock Structural Recovery Layer
                                                async function applyRecoveryIfNeeded(page, originalSections, originalCompleteness, originalConfidence) {
                                                  let recoveryApplied = false;
                                                  let recoveredSections = [];
                                                  let recoveredCompleteness = originalCompleteness;
                                                  let recoveredConfidence = originalConfidence;
                                                  if (originalCompleteness < 0.65) {
                                                    recoveredSections = await structuralRecoveryLayer(page);
                                                    if (recoveredSections.length) {
                                                      recoveryApplied = true;
                                                      // Recalculate completeness and confidence
                                                      const recoveredItems = recoveredSections.reduce((acc, sec) => acc + (sec.items ? sec.items.length : 0), 0);
                                                      recoveredCompleteness = Math.min(1, recoveredItems / 60);
                                                      recoveredConfidence = Math.min(85, Math.max(originalConfidence, Math.floor(recoveredCompleteness * 100)));
                                                      // Use higher of original or recovered
                                                      if (recoveredCompleteness > originalCompleteness) {
                                                        return { sections: recoveredSections, completeness: recoveredCompleteness, confidence: recoveredConfidence, recoveryApplied };
                                                      }
                                                    }
                                                  }
                                                  return { sections: originalSections, completeness: originalCompleteness, confidence: originalConfidence, recoveryApplied };
                                                }
                                          // Structural Recovery Layer for low completeness domains
                                          async function structuralRecoveryLayer(page) {
                                            // DOM price harvesting
                                            const priceNodes = await page.evaluate(() => {
                                              const results = [];
                                              const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
                                              while (walker.nextNode()) {
                                                const node = walker.currentNode;
                                                const text = node.textContent.trim();
                                                if (/\$\d{1,3}\.\d{2}/.test(text)) {
                                                  // Find nearest sibling text as candidate item name
                                                  let name = '';
                                                  if (node.previousSibling && node.previousSibling.textContent) {
                                                    name = node.previousSibling.textContent.trim();
                                                  } else if (node.parentNode && node.parentNode.previousSibling && node.parentNode.previousSibling.textContent) {
                                                    name = node.parentNode.previousSibling.textContent.trim();
                                                  }
                                                  results.push({ price: text, name });
                                                }
                                              }
                                              return results;
                                            });
                                            // Cluster by vertical proximity (simulate with array grouping)
                                            let clusters = [];
                                            let currentSection = [];
                                            for (let i = 0; i < priceNodes.length; i++) {
                                              if (i === 0 || priceNodes[i].name !== priceNodes[i-1].name) {
                                                if (currentSection.length) clusters.push(currentSection);
                                                currentSection = [];
                                              }
                                              currentSection.push(priceNodes[i]);
                                            }
                                            if (currentSection.length) clusters.push(currentSection);
                                            // Create synthetic sections if price clusters ≥ 10
                                            let syntheticSections = [];
                                            if (clusters.length >= 10) {
                                              syntheticSections = clusters.map((cluster, idx) => ({
                                                section: `Synthetic Section ${idx+1}`,
                                                items: cluster.map(item => ({ name: item.name, price: item.price }))
                                              }));
                                            }
                                            return syntheticSections;
                                          }
                                    // Phase: Hardening improvements
                                    // Network interception for NO_DATA domains
                                    function enableNetworkInterception(page) {
                                      page.setRequestInterception(true);
                                      const xhrEndpoints = [];
                                      page.on('request', req => req.continue());
                                      page.on('response', async res => {
                                        const ct = res.headers()['content-type'] || '';
                                        if (ct.includes('application/json')) {
                                          xhrEndpoints.push(res.url());
                                        }
                                      });
                                      return xhrEndpoints;
                                    }
                                    // Deterministic LocationResolver
                                    async function deterministicLocationResolver(page) {
                                      // Auto-select first valid store ID if required
                                      await page.evaluate(() => {
                                        const storeSelect = document.querySelector('select[name*="store"], select[name*="location"]');
                                        if (storeSelect && storeSelect.options.length > 0) {
                                          storeSelect.selectedIndex = 1;
                                          storeSelect.dispatchEvent(new Event('change', { bubbles: true }));
                                        }
                                      });
                                    }
                              // Automatic Build-Your-Own detection
                              const domain = (restaurant.website || restaurant.menuUrl || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
                              function detectCustomizableModel(rawMenuData) {
                                if (!rawMenuData || typeof rawMenuData !== 'object') return false;
                                const keys = Object.keys(rawMenuData);
                                // Modifier-to-base ratio
                                let baseItems = [];
                                let modifiers = [];
                                for (const k of keys) {
                                  if (/product|item|menu|burgers|dogs|fries|sandwiches|base/i.test(k) && Array.isArray(rawMenuData[k])) baseItems = rawMenuData[k];
                                  if (/modifier|topping|option|ingredient|build|customize/i.test(k) && Array.isArray(rawMenuData[k])) modifiers = rawMenuData[k];
                                }
                                const modifierRatio = baseItems.length > 0 ? (modifiers.length / baseItems.length) : 0;
                                if (modifierRatio > 2.0) return true;
                                // Price checks
                                let noPriceCount = 0;
                                let sizePriceCount = 0;
                                let total = 0;
                                for (const item of baseItems) {
                                  total++;
                                  const price = item.price || item.basePrice || item.amount;
                                  if (!price || price === 0) noPriceCount++;
                                  if (item.sizes && Array.isArray(item.sizes)) {
                                    let hasSizePrice = item.sizes.some(sz => sz.price && sz.price > 0);
                                    if (hasSizePrice) sizePriceCount++;
                                  }
                                }
                                if (total > 0 && (noPriceCount / total) > 0.6) return true;
                                if (total > 0 && (sizePriceCount / total) > 0.6) return true;
                                // Structure keys
                                const structureKeys = ["toppings", "options", "modifiers", "ingredients", "build", "customize"];
                                if (keys.some(k => structureKeys.includes(k.toLowerCase()))) return true;
                                // Few base items, many modifiers
                                if (baseItems.length < 5 && modifiers.length > 20) return true;
                                return false;
                              }
                        // Automatic API Promotion Logic
                        let apiPromotionTriggered = false;
                        let promotedApiEndpoint = null;
                        let promotedApiKeys = [];
                        let promotedApiResponse = null;
                        // Declare browser, page, puppeteer only once
                        // ...existing code...
                        if (puppeteerModule && typeof puppeteerModule.default === 'function' && typeof puppeteerModule.default.launch === 'function') {
                          puppeteer = puppeteerModule.default;
                        } else if (puppeteerModule && typeof puppeteerModule.launch === 'function') {
                          puppeteer = puppeteerModule;
                        } else if (puppeteerModule && typeof puppeteerModule.default === 'object' && typeof puppeteerModule.default.launch === 'function') {
                          puppeteer = puppeteerModule.default;
                        } else {
                          puppeteer = undefined;
                        }
                        if (puppeteer && typeof puppeteer.launch === 'function') {
                          try {
                            browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
                            page = await browser.newPage();
                            await page.goto(restaurant.menuUrl || restaurant.website, { waitUntil: "networkidle2" });
                            await page.setRequestInterception(true);
                            page.on('request', req => req.continue());
                            page.on('response', async res => {
                              if (res.request().method() === 'GET') {
                                const ct = res.headers()['content-type'] || '';
                                if (ct.includes('application/json')) {
                                  let body = null;
                                  try { body = await res.json(); } catch (e) { return; }
                                  const size = JSON.stringify(body).length;
                                  const keys = body && typeof body === 'object' ? Object.keys(body) : [];
                                  if (size > 2000 && keys.some(k => /menu|items|products|categories/i.test(k))) {
                                    apiPromotionTriggered = true;
                                    promotedApiEndpoint = res.url();
                                    promotedApiKeys = keys;
                                    promotedApiResponse = body;
                                  }
                                }
                              }
                            });
                            await page.reload({ waitUntil: "networkidle2" });
                            await new Promise(r => setTimeout(r, 3000));
                            try { if (browser) await browser.close(); } catch (e) {}
                          } catch (e) { try { if (browser) await browser.close(); } catch (e2) {} }
                        }
                        if (apiPromotionTriggered && promotedApiEndpoint && promotedApiResponse) {
                          // Automatic customizable menu detection
                          const customizableDetected = detectCustomizableModel(promotedApiResponse);
                          let totalBaseItems, totalModifierCount, fixedPriceItemCount, modifierToBaseRatio, finalDecision = 'rejected';
                          const keys = Object.keys(promotedApiResponse);
                          let baseItems = [];
                          let modifiers = [];
                          for (const k of keys) {
                            if (/product|item|menu|burgers|dogs|fries|sandwiches|base/i.test(k) && Array.isArray(promotedApiResponse[k])) baseItems = promotedApiResponse[k];
                            if (/modifier|topping|option|ingredient|build|customize/i.test(k) && Array.isArray(promotedApiResponse[k])) modifiers = promotedApiResponse[k];
                          }
                          if (!Array.isArray(baseItems) || !Array.isArray(modifiers)) throw new Error('CLASSIFIER_METRIC_COMPUTATION_FAILED');
                          totalBaseItems = baseItems.length;
                          totalModifierCount = 0;
                          fixedPriceItemCount = 0;
                          for (const item of baseItems) {
                            const price = item.price || item.basePrice || item.amount;
                            if (price && price > 0) fixedPriceItemCount++;
                            // Count nested modifiers/options
                            if (Array.isArray(item.toppings)) totalModifierCount += item.toppings.length;
                            if (Array.isArray(item.options)) totalModifierCount += item.options.length;
                            if (Array.isArray(item.modifiers)) totalModifierCount += item.modifiers.length;
                          }
                          // Add top-level modifiers/options
                          totalModifierCount += modifiers.length;
                          modifierToBaseRatio = totalBaseItems > 0 ? (totalModifierCount / totalBaseItems) : 0;
                          if ([totalBaseItems, totalModifierCount, fixedPriceItemCount, modifierToBaseRatio].some(v => typeof v !== 'number' || isNaN(v))) throw new Error('CLASSIFIER_METRIC_COMPUTATION_FAILED');
                          let skipped = false;
                          let OUTCOME_TYPE = 'NORMAL';
                          // Classifier runs BEFORE adapter normalization and confidence scoring
                          if (modifierToBaseRatio >= 3 && totalBaseItems <= 10) {
                            skipped = true;
                            OUTCOME_TYPE = 'REJECTED_CUSTOMIZABLE_MENU_MODEL';
                          }
                          if (totalBaseItems >= 15) {
                            skipped = false;
                            OUTCOME_TYPE = 'NORMAL';
                          }
                          // Final summary object with classification
                          const summary = {
                            DOMAIN: domain,
                            skipped,
                            OUTCOME_TYPE,
                            classification: {
                              customizableDetected,
                              modifierToBaseRatio,
                              totalBaseItems
                            }
                          };
                          if (skipped) return summary;
                          // ...existing extraction logic...
                        }
                  // Transport Mapping for outback.com after LOCATION_AUTO_RESOLVED
                  if (domain === 'outback.com' && locationAutoResolved) {
                    // ...existing code...
                    if (puppeteerModule && typeof puppeteerModule.default === 'function' && typeof puppeteerModule.default.launch === 'function') {
                      puppeteer = puppeteerModule.default;
                    } else if (puppeteerModule && typeof puppeteerModule.launch === 'function') {
                      puppeteer = puppeteerModule;
                    } else if (puppeteerModule && typeof puppeteerModule.default === 'object' && typeof puppeteerModule.default.launch === 'function') {
                      puppeteer = puppeteerModule.default;
                    } else {
                      puppeteer = undefined;
                    }
                    let hydrationStateFound = false;
                    let graphqlEndpointFound = false;
                    let postJsonEndpoints = [];
                    let scriptEmbeddedJsonKeys = [];
                    if (puppeteer && typeof puppeteer.launch === 'function') {
                      try {
                        browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
                        page = await browser.newPage();
                        await page.goto(menuUrl, { waitUntil: "networkidle2" });
                        // Dump all <script> tags
                        const scripts = await page.evaluate(() => Array.from(document.querySelectorAll('script')).map(s => s.innerText));
                        for (const script of scripts) {
                          if (/__INITIAL_STATE__|window\.|apollo|graphql|menu|products/i.test(script)) {
                            hydrationStateFound = true;
                            // Try to extract JSON
                            const jsonMatches = script.match(/({[\s\S]*?})/g);
                            if (jsonMatches) {
                              for (const jm of jsonMatches) {
                                try {
                                  const parsed = JSON.parse(jm);
                                  scriptEmbeddedJsonKeys.push(...Object.keys(parsed));
                                } catch (e) {}
                              }
                            }
                          }
                        }
                        // Intercept POST requests and GraphQL endpoints
                        await page.setRequestInterception(true);
                        page.on('request', req => {
                          if (req.method() === 'POST') {
                            const url = req.url();
                            if (/graphql/i.test(url)) graphqlEndpointFound = true;
                            if (/json/i.test(req.headers()['content-type'] || '')) postJsonEndpoints.push(url);
                          }
                          req.continue();
                        });
                        await page.reload({ waitUntil: "networkidle2" });
                        await new Promise(r => setTimeout(r, 3000));
                        try { if (browser) await browser.close(); } catch (e) {}
                      } catch (e) { try { if (browser) await browser.close(); } catch (e2) {} }
                    }
                    console.log(JSON.stringify({
                      HYDRATION_STATE_FOUND: hydrationStateFound,
                      GRAPHQL_ENDPOINT_FOUND: graphqlEndpointFound,
                      POST_JSON_ENDPOINTS: postJsonEndpoints,
                      SCRIPT_EMBEDDED_JSON_KEYS: scriptEmbeddedJsonKeys
                    }));
                    return;
                  }
            // Network Interception after Location Auto-Resolved
            if (domain === 'olivegarden.com' && locationAutoResolved) {
              // ...existing code...
              if (puppeteerModule && typeof puppeteerModule.default === 'function' && typeof puppeteerModule.default.launch === 'function') {
                puppeteer = puppeteerModule.default;
              } else if (puppeteerModule && typeof puppeteerModule.launch === 'function') {
                puppeteer = puppeteerModule;
              } else if (puppeteerModule && typeof puppeteerModule.default === 'object' && typeof puppeteerModule.default.launch === 'function') {
                puppeteer = puppeteerModule.default;
              } else {
                puppeteer = undefined;
              }
              if (puppeteer && typeof puppeteer.launch === 'function') {
                try {
                  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
                  page = await browser.newPage();
                  await page.goto(menuUrl, { waitUntil: "networkidle2" });
                  await page.setRequestInterception(true);
                  const jsonEndpoints = [];
                  page.on('request', req => {
                    req.continue();
                  });
                  page.on('response', async res => {
                    const url = res.url();
                    const ct = res.headers()['content-type'] || '';
                    if (ct.includes('application/json')) {
                      const status = res.status();
                      let body = null;
                      try { body = await res.json(); } catch (e) { return; }
                      const size = JSON.stringify(body).length;
                      const keys = body && typeof body === 'object' ? Object.keys(body) : [];
                      const containsPrice = keys.some(k => k.toLowerCase().includes('price')) || (Array.isArray(body) && body.some(obj => obj && typeof obj === 'object' && Object.keys(obj).some(k => k.toLowerCase().includes('price'))));
                      const arrayLengths = keys.reduce((acc, k) => {
                        if (Array.isArray(body[k])) acc[k] = body[k].length;
                        return acc;
                      }, {});
                      jsonEndpoints.push({
                        ENDPOINT_URL: url,
                        RESPONSE_STATUS: status,
                        RESPONSE_SIZE: size,
                        TOP_LEVEL_KEYS: keys,
                        CONTAINS_PRICE_FIELD: containsPrice,
                        ARRAY_LENGTHS: arrayLengths
                      });
                      console.log(JSON.stringify(jsonEndpoints[jsonEndpoints.length-1]));
                    }
                  });
                  await page.reload({ waitUntil: "networkidle2" });
                  await new Promise(r => setTimeout(r, 5000)); // Wait for network events
                  try { if (browser) await browser.close(); } catch (e) {}
                } catch (e) { try { if (browser) await browser.close(); } catch (e2) {} }
              }
              return;
            }
      // ...existing variable declarations...
      // Domain eligibility gate
      // domain already declared above for eligibility filter
      let homepageHtml = '';
      try {
        if (restaurant.website) {
          const res = await axios.get(restaurant.website, { timeout: 10000 });
          homepageHtml = res.data;
        }
      } catch (e) {}
      const eligibility = isEligibleRestaurantDomain(domain, homepageHtml);
      let pipelineStageReport = {
        domain,
        siteType: 'unknown',
        eligibilityPassed: eligibility.eligible,
        twoHopUsed: false,
        apiDetected: false,
        adapterUsed: null,
        totalSections: 0,
        totalItems: 0,
        priceDensity: 0,
        confidence: 0,
        skipped: !eligibility.eligible,
        OUTCOME_TYPE: 'NO_DATA',
        LOCATION_AUTO_RESOLVED: false
      };
            // Location Auto-Resolver
            let locationAutoResolved = false;
            let menuUrl = restaurant.menuUrl || restaurant.website;
            if (eligibility.eligible) {
              // ...existing code...
              if (puppeteerModule && typeof puppeteerModule.default === 'function' && typeof puppeteerModule.default.launch === 'function') {
                puppeteer = puppeteerModule.default;
              } else if (puppeteerModule && typeof puppeteerModule.launch === 'function') {
                puppeteer = puppeteerModule;
              } else if (puppeteerModule && typeof puppeteerModule.default === 'object' && typeof puppeteerModule.default.launch === 'function') {
                puppeteer = puppeteerModule.default;
              } else {
                puppeteer = undefined;
              }
              if (puppeteer && typeof puppeteer.launch === 'function') {
                try {
                  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
                  page = await browser.newPage();
                  await page.goto(menuUrl, { waitUntil: "networkidle2" });
                  // Detect location modal
                  const modalDetected = await page.evaluate(() => {
                    const modal = document.body.innerText.includes("Select Location");
                    const zipInput = !!document.querySelector('input[type="text"][name*="zip"]');
                    const cityDropdown = !!document.querySelector('select[name*="city"]');
                    return modal || zipInput || cityDropdown;
                  });
                  if (modalDetected) {
                    // Try to select first location option
                    await page.evaluate(() => {
                      const dropdown = document.querySelector('select[name*="city"]');
                      if (dropdown && dropdown.options.length > 0) {
                        dropdown.selectedIndex = 0;
                        dropdown.dispatchEvent(new Event('change', { bubbles: true }));
                      }
                      const zipInput = document.querySelector('input[type="text"][name*="zip"]');
                      if (zipInput) {
                        zipInput.value = '28202';
                        zipInput.dispatchEvent(new Event('input', { bubbles: true }));
                      }
                      const submitBtn = document.querySelector('button[type="submit"]');
                      if (submitBtn) submitBtn.click();
                    });
                    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 });
                    // Confirm cookie/state set
                    const locationSet = await page.evaluate(() => {
                      return document.cookie.includes('location') || window.localStorage.getItem('location') || window.sessionStorage.getItem('location');
                    });
                    if (locationSet) {
                      locationAutoResolved = true;
                      await page.reload({ waitUntil: "networkidle2" });
                      menuUrl = page.url();
                    }
                  }
                  try { if (browser) await browser.close(); } catch (e) {}
                } catch (e) { try { if (browser) await browser.close(); } catch (e2) {} }
              }
            }
            pipelineStageReport.LOCATION_AUTO_RESOLVED = locationAutoResolved;
      if (!eligibility.eligible) {
        pipelineStageReport.OUTCOME_TYPE = 'SKIPPED';
        console.log(JSON.stringify(pipelineStageReport));
        return {
          skipped: true,
          reason: 'Domain not eligible for food extraction',
          confidence: 0
        };
      }

      // --- Fallback text-block parser for WordPress visual-builder menus ---
      async function runTextBlockParser(page) {
        // Step 1: Extract and preprocess lines
        let text = await page.evaluate(() => {
          let main = document.querySelector("main");
          if (main && main.innerText) return main.innerText;
          let fusion = document.querySelector(".fusion-column-wrapper");
          if (fusion && fusion.innerText) return fusion.innerText;
          return "";
        });
        // Debug logging for text extraction
        console.log("TEXT_BLOCK_INNER_TEXT_LENGTH", text.length);
        console.log("TEXT_BLOCK_INNER_TEXT_PREVIEW", text.slice(0, 2000));

        let lines = text.split("\n")
          .map(l => l.trim().replace(/\s+/g, " "))
          .filter(l => l.length > 0);

        // Step 2: Price regex
        const priceRegex = /\$?\d{1,3}(\.\d{1,2})?$/;

        // Step 3-5: Section and item detection
        let sections = [];
        let currentSection = null;
        let currentItem = null;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const nextLine = lines[i + 1] || "";

          // Section header: short, not price, next line is price
          if (
            line.length < 40 &&
            !priceRegex.test(line) &&
            priceRegex.test(nextLine)
          ) {
            currentSection = { section: line, items: [] };
            sections.push(currentSection);
            continue;
          }

          // If no section yet, create default
          if (!currentSection) {
            currentSection = { section: "Uncategorized", items: [] };
            sections.push(currentSection);
          }

          // Item detection: line ends with price
          if (priceRegex.test(line)) {
            // Extract price
            const priceMatch = line.match(priceRegex);
            const price = priceMatch ? priceMatch[0] : null;
            let name = line.replace(priceRegex, "").trim();
            let description = "";

            // Check next line for description
            if (
              nextLine &&
              !priceRegex.test(nextLine) &&
              nextLine.length < 80
            ) {
              description = nextLine;
            }

            currentSection.items.push({
              name,
              price,
              description
            });
            continue;
          }
        }

        // Log first 3 items for inspection
        let first3Items = [];
        for (const s of sections) {
          for (const item of s.items) {
            if (first3Items.length < 3) first3Items.push(item);
          }
        }
        console.log("TEXT_BLOCK_FIRST_3_ITEMS", JSON.stringify(first3Items, null, 2));
        return sections;
      }

    let out = {
      restaurant: restaurant?.name || null,
      menu_sections: []
    };
      let browser = null;
      let page = null;
      let html = "";
      let hostingPlatform = "unknown";
      let menuPlatform = "unknown";
      let extractionStrategy = "unknown";
      let headers = {};
      let scripts = [];
      let currentUrl = "";
      let scriptMatches = [];
      let iframeMatches = [];
      let anchorMatches = [];
      let itemsPerSection = [];
      let totalItems = 0;
      let totalSections = 0;
      sections = [];
      fallbackTriggered = false;
      fallbackSections = [];
      first3Items = [];
      sample_alignment = null;

      let puppeteer;
      let puppeteerModule = await import('puppeteer');
      // Try .default, then direct module
      if (puppeteerModule && typeof puppeteerModule.default === 'function' && typeof puppeteerModule.default.launch === 'function') {
        puppeteer = puppeteerModule.default;
      } else if (puppeteerModule && typeof puppeteerModule.launch === 'function') {
        puppeteer = puppeteerModule;
      } else if (puppeteerModule && typeof puppeteerModule.default === 'object' && typeof puppeteerModule.default.launch === 'function') {
        puppeteer = puppeteerModule.default;
      } else {
        puppeteer = undefined;
      }
      const puppeteerDiagnostics = {
        PUPPETEER_MODULE_TYPE: typeof puppeteerModule,
        PUPPETEER_MODULE_DEFAULT_TYPE: typeof puppeteerModule?.default,
        PUPPETEER_MODULE_KEYS: Object.keys(puppeteerModule || {}),
        PUPPETEER_TYPE: typeof puppeteer,
        HAS_LAUNCH: typeof puppeteer?.launch
      };
      console.log("PUPPETEER_DIAGNOSTICS", JSON.stringify(puppeteerDiagnostics, null, 2));
      if (!puppeteer || typeof puppeteer.launch !== 'function') {
        console.log("BROWSER_LAUNCH_ERROR", "Puppeteer launch function not found");
        return {
          launchError: true,
          message: 'Puppeteer launch function not found'
        };
      }
      try {
        browser = await puppeteer.launch({
          headless: "new",
          args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
      } catch (err) {
        console.log("BROWSER_LAUNCH_ERROR", err?.stack || err);
        return {
          launchError: true,
          message: err.message
        };
      }

      page = await browser.newPage();
      await page.goto(restaurant.menuUrl || restaurant.website, { waitUntil: "networkidle2" });
      currentUrl = page.url();
      console.log("NAVIGATED_TO_URL:", currentUrl);

      // --- Wait-for-Text-Length-Stability and menu-like keyword ---
      const menuKeywords = ["Appetizers", "Entrees", "Price", "Menu", "Dinner", "Lunch", "Brunch", "Dessert", "Starters", "Salads", "Sides", "Drinks", "Cocktails", "Wine", "Beer"];
      let lastLength = 0;
      let stableCount = 0;
      let foundMenuKeyword = false;
      for (let i = 0; i < 40; i++) { // up to 20s
        const innerText = await page.evaluate(() => document.body.innerText);
        const length = innerText.length;
        if (length === lastLength) {
          stableCount++;
        } else {
          stableCount = 0;
        }
        lastLength = length;
        foundMenuKeyword = menuKeywords.some(k => innerText.includes(k));
        if (stableCount >= 3 && foundMenuKeyword) break;
        await new Promise(r => setTimeout(r, 500));
      }

      html = await page.content();
      console.log("HTML_LENGTH:", html.length);
      console.log("HTML_CONTAINS_PRICE_SYMBOL:", html.includes("$"));
      console.log("HTML_SAMPLE_SNIPPET:", html.slice(0, 1000));

      // Structured HTML extraction for custom-html menus
      const $ = cheerio.load(html);
      sections = [];
      let currentSection = null;

      $("h1, h2, h3, h4").each((i, el) => {
        const heading = $(el).text().trim();
        if (!heading) return;

        currentSection = {
          name: heading,
          items: []
        };

        let sibling = $(el).next();
        while (sibling.length && !/^h[1-4]$/i.test(sibling[0].tagName)) {
          const text = sibling.text().trim();

          const priceMatch = text.match(/\$\d+(\.\d{2})?/);
          if (priceMatch) {
            currentSection.items.push({
              name: text.replace(priceMatch[0], "").trim(),
              price: priceMatch[0]
            });
          }

          sibling = sibling.next();
        }

        if (currentSection.items.length > 0) {
          sections.push(currentSection);
        }
      });

      out.menu_sections = sections;
      // Assign primary extraction results to shared summary variables
      totalSections = sections.length;
      itemsPerSection = sections.map(sec => Array.isArray(sec.items) ? sec.items.length : 0);
      totalItems = itemsPerSection.reduce((acc, n) => acc + n, 0);
      first3Items = [];
      sample_alignment = [];
      for (let sec of sections) {
        if (Array.isArray(sec.items)) {
          for (let item of sec.items) {
            if (first3Items.length < 3) {
              first3Items.push(item);
              let fragment = null;
              if (item.name) {
                const regex = new RegExp(item.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
                const match = html.match(regex);
                if (match) {
                  const idx = match.index;
                  fragment = html.substring(Math.max(0, idx - 75), Math.min(html.length, idx + 75));
                }
              }
              sample_alignment.push({
                name: item.name,
                price: item.price,
                description: item.description,
                raw_text_fragment: fragment || 'N/A'
              });
            }
          }
        }
        if (first3Items.length >= 3) break;
      }

      // Fallback: If structured extraction found nothing or confidenceScore < 0.3, run ModernLayoutStrategy
      fallbackTriggered = false;
      fallbackSections = [];
      // Fallback logic moved after confidence calculation
      headers = await page.evaluate(() => {
        const meta = {};
        document.querySelectorAll("meta").forEach(m => {
          if (m.name) meta[m.name] = m.content;
        });
        return meta;
      });
      scripts = await page.evaluate(() =>
        Array.from(document.querySelectorAll("script"))
          .map(s => s.src || s.innerHTML)
          .filter(Boolean)
      );

        // === STRUCTURAL DOM RECONNAISSANCE ===
        console.log("PAGE_BEFORE_EVALUATE:", page);
        const links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("a"))
            .map(a => ({
              href: a.href,
              text: a.innerText.trim()
            }));
        });
        console.log("[ALL_LINK_COUNT]", links.length);
        console.log("[ALL_LINKS_FULL]", links);
        // Step 1: Log candidate location links
        console.log("CANDIDATE_LINKS_WITH_MENU_TEXT:",
          links.filter(l =>
            /menu/i.test(l.text || "") ||
            /menu/i.test(l.href || "")
          ).slice(0, 20)
        );
        // Step 2: Auto-select and follow first real location menu link
        const locationMenuLink = links.find(l =>
          /\/locations\//i.test(l.href) &&
          !/locations-menus/i.test(l.href)
        );
        if (locationMenuLink) {
          console.log("FOLLOWING_LOCATION_MENU_LINK:", locationMenuLink.href);
          await page.goto(locationMenuLink.href, { waitUntil: "networkidle2" });
          html = await page.content();
          console.log("NEW_PAGE_URL:", page.url());
          console.log("NEW_HTML_LENGTH:", html.length);
        }

        console.log("PAGE_BEFORE_EVALUATE:", page);
        const iframes = await page.evaluate(() => {
            console.log("[POST_NAVIGATION_REACHED]");
            return Array.from(document.querySelectorAll("iframe"))
                .map(i => i.src);
        });
        console.log("[IFRAME_COUNT]", iframes.length);
        console.log("[IFRAME_SOURCES]", iframes);

        console.log("PAGE_BEFORE_EVALUATE:", page);
        const buttons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("button"))
                .map(b => b.innerText.trim());
        });
        console.log("[BUTTON_TEXTS]", buttons);

        // Detect location cards with links
        console.log("PAGE_BEFORE_EVALUATE:", page);
        const locationAnchors = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("a"))
                .filter(a => a.href.includes("/locations/"))
                .map(a => ({
                    href: a.href,
                    text: a.innerText.trim()
                }));
        });
        console.log("[LOCATION_PAGE_LINKS]", locationAnchors);

        // Dump all headings (h1-h4)
        console.log("PAGE_BEFORE_EVALUATE:", page);
        const headings = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("h1, h2, h3, h4"))
                .map(h => h.innerText.trim())
                .filter(Boolean);
        });
        console.log("[ALL_HEADINGS]", headings);

        // Dump all elements containing price patterns (sample)
        console.log("PAGE_BEFORE_EVALUATE:", page);
        const priceElements = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll("*"));
            return elements
                .filter(el => /\$\d+/.test(el.innerText))
                .map(el => el.innerText.trim())
                .slice(0, 50);
        });
        console.log("[PRICE_ELEMENTS_SAMPLE]", priceElements);

        // ...existing scraper logic...
    // ...existing scraper logic...
    // Move browser.close() to after all extraction logic
  // Will log all network requests to hunt for menu data
  // Will log all network requests to hunt for menu data
  const networkLog = [];
  // Duplicate out declaration removed
  if (!restaurant.website) {
    console.log("[EARLY_RETURN_TRIGGERED]");
    console.log("EARLY_RETURN_REASON_VALUES:");
    console.log({
      restaurant,
      hasName: !!restaurant?.name,
      hasMenuUrl: !!restaurant?.menuUrl,
      hasUrl: !!restaurant?.url,
      hasPlatform: !!restaurant?.platform
    });
    return { restaurant: restaurant.name || null, menu_sections: [] };
        // ...existing code...

        // Generic REST Menu API Adapter
        async function genericRestMenuApiAdapter({ endpoints }) {
          let sections = [];
          for (const ep of endpoints) {
            try {
              const res = await axios.get(ep);
              const data = res.data;
              const payloadLength = JSON.stringify(data).length;
              const keys = Object.keys(data);
              // Print structure: keys + nested keys
              const structure = {};
              for (const k of keys) {
                if (Array.isArray(data[k]) && data[k].length > 0 && typeof data[k][0] === 'object') {
                  structure[k] = Object.keys(data[k][0]);
                } else if (typeof data[k] === 'object' && data[k] !== null) {
                  structure[k] = Object.keys(data[k]);
                } else {
                  structure[k] = typeof data[k];
                }
              }
              console.log({ RAW_JSON_PAYLOAD_LENGTH: payloadLength, STRUCTURE: structure });
              // Identify base products, modifiers, sizes
              let baseProducts = [];
              let modifiers = [];
              let sizes = [];
              // Heuristic: look for keys like 'products', 'menu', 'items', 'burgers', 'dogs', 'fries', 'sandwiches'
              for (const k of keys) {
                if (/product|item|menu|burgers|dogs|fries|sandwiches/i.test(k) && Array.isArray(data[k])) {
                  baseProducts = data[k];
                }
                if (/modifier|topping|add/i.test(k) && Array.isArray(data[k])) {
                  modifiers = data[k];
                }
                if (/size/i.test(k) && Array.isArray(data[k])) {
                  sizes = data[k];
                }
              }
              // Map to single section 'Menu', each item: name, basePrice, modifierCount
              if (Array.isArray(baseProducts) && baseProducts.length) {
                sections = [
                  {
                    section: 'Menu',
                    items: baseProducts.map(obj => ({
                      name: obj.name || obj.title || '',
                      basePrice: obj.price || obj.basePrice || obj.amount || '',
                      modifierCount: Array.isArray(obj.toppings) ? obj.toppings.length : Array.isArray(modifiers) ? modifiers.length : 0
                    }))
                  }
                ];
              }
            } catch (err) {}
          }
          return { sections };
        }
      scriptMatches = scripts.filter(s => /toast|wordpress|bento|focuspos|menu|wix|squarespace|olo|doordash|square/i.test(s));
      iframeMatches = $('iframe').map((i, el) => $(el).attr('src')).get().filter(Boolean);
      anchorMatches = $('a').map((i, el) => $(el).attr('href')).get().filter(Boolean);
  }

  // --- HOSTING PLATFORM DETECTION ---
  // Only for metadata, never for routing
  if (html && (html.toLowerCase().includes('wp-content') || html.toLowerCase().includes('wp-json') || scripts.some(s => /wp-/.test(s)))) {
    hostingPlatform = 'wordpress';
  } else if (html && html.toLowerCase().includes('wix.com')) {
    hostingPlatform = 'wix';
  } else if (html && html.toLowerCase().includes('squarespace')) {
    hostingPlatform = 'squarespace';
  }

  // --- MENU PLATFORM DETECTION (for routing) ---
  let platformResult = detectPlatform({ html, headers, scripts, url: currentUrl });
  menuPlatform = platformResult.platform || 'unknown';
  if (menuPlatform === 'wordpress' || menuPlatform === 'wix' || menuPlatform === 'squarespace') {
    // These are only hosting platforms, not menu platforms
    menuPlatform = 'custom-html';
  }
  extractionStrategy = menuPlatform;
  console.log('[PLATFORM_DETECTION]', {
    url: currentUrl,
    hostingPlatform,
    menuPlatform,
    extractionStrategy,
    scriptMatches,
    iframeMatches,
    anchorMatches
  });

  // --- ENFORCE REAL TWO-HOP ---
  let twoHopUsed = false;
  let twoHopResult = null;
  let originalUrl = currentUrl;
  if (menuPlatform === 'custom-html' || menuPlatform === 'unknown') {
    const $ = cheerio.load(html);
    const allLinks = $('a').map((i, el) => ({
      href: $(el).attr('href'),
      text: $(el).text()
    })).get();
    const candidateLinks = allLinks.filter(l => {
      const href = (l.href || '').toLowerCase();
      if (!href) return false;
      if (href.includes('facebook.com') || href.includes('instagram.com') || href.includes('twitter.com') || href.includes('tiktok.com')) return false;
      if (href.endsWith('.pdf')) return false;
      if (href.includes('menu') || href.includes('order') || href.includes('locations')) return true;
      return false;
    });
    const selectedLink = candidateLinks.length ? candidateLinks[0] : null;
    console.log('[TWO_HOP_SCAN]', {
      totalLinks: allLinks.length,
      candidateLinks,
      selectedLink
    });
    if (selectedLink && selectedLink.href) {
      twoHopUsed = true;
      let hopUrl = selectedLink.href;
      if (!/^https?:\/\//.test(hopUrl)) {
        hopUrl = new URL(hopUrl, currentUrl).href;
      }
      try {
        const res = await axios.get(hopUrl, { timeout: 20000 });
        html = res.data;
        headers = res.headers || {};
        currentUrl = hopUrl;
        // Re-extract scripts/iframes/anchors after hop
        const $hop = cheerio.load(html);
        scripts = $hop('script')
          .map((i, el) => $hop(el).attr('src') || $hop(el).html() || '')
          .get()
          .filter(Boolean);
        scriptMatches = scripts.filter(s => /toast|wordpress|bento|focuspos|menu|wix|squarespace|olo|doordash|square/i.test(s));
        iframeMatches = $hop('iframe').map((i, el) => $hop(el).attr('src')).get().filter(Boolean);
        anchorMatches = $hop('a').map((i, el) => $hop(el).attr('href')).get().filter(Boolean);
        // Re-run menu platform detection after hop
        platformResult = detectPlatform({ html, headers, scripts, url: currentUrl });
        menuPlatform = platformResult.platform || 'unknown';
        if (menuPlatform === 'wordpress' || menuPlatform === 'wix' || menuPlatform === 'squarespace') {
          menuPlatform = 'custom-html';
        }
        extractionStrategy = menuPlatform;
        console.log('[PLATFORM_DETECTION]', {
          url: currentUrl,
          hostingPlatform,
          menuPlatform,
          extractionStrategy,
          scriptMatches,
          iframeMatches,
          anchorMatches
        });
        console.log('[TWO_HOP_RESULT]', {
          finalUrl: currentUrl,
          reDetectedPlatform: menuPlatform
        });
      } catch (err) {
        logger.warn(`[TWO_HOP_NAVIGATION_FAILED] ${err.message}`);
      }
    }
    // Only assign method = two-hop-structured if URL changed
    if (currentUrl !== originalUrl && menuPlatform !== 'custom-html' && menuPlatform !== 'unknown') {
      extractionStrategy = menuPlatform;
      // method = two-hop-structured
    } else {
      // If URL did not change, do not assign two-hop
      twoHopUsed = false;
    }
  }

  // Route to adapter (do not modify extraction logic)
  let adapterResult;
  let adapter = null;
  // GraphQL Menu API Detection Layer
  let graphqlDetected = false;
  let graphqlEndpoint = null;
  let graphqlQuery = null;
  let graphqlVariables = null;
  let graphqlHeaders = null;
  let scriptKeys = [];
  // Simulate detection from prior signals (replace with real interception in production)
  if (typeof HYDRATION_STATE_FOUND !== 'undefined' && HYDRATION_STATE_FOUND && typeof GRAPHQL_ENDPOINT_FOUND !== 'undefined' && GRAPHQL_ENDPOINT_FOUND && scriptKeys.some(k => /menu|products|categories/i.test(k))) {
    graphqlDetected = true;
    menuPlatform = 'graphql-api';
    extractionStrategy = 'graphql-api';
    autoRoutedAdapter = 'graphqlMenuAdapter';
    // Example: extract endpoint/query/variables/headers from prior interception
    graphqlEndpoint = '/graphql';
    graphqlQuery = '{ categories { id name } products { id name price categoryId description } }';
    graphqlVariables = {};
    graphqlHeaders = { 'Content-Type': 'application/json' };
    adapter = async (args) => graphqlMenuAdapter({ graphqlEndpoint, query: graphqlQuery, variables: graphqlVariables, headers: graphqlHeaders });
  } else {
    // Generic REST Menu API Detection Layer
    let apiDetected = false;
    let detectedEndpoints = [];
    let autoRoutedAdapter = null;
    const candidateEndpoints = [
      '/api/menu/categories',
      '/api/menu/items'
    ];
    let itemsArray = [];
    let categoriesArray = [];
    for (const ep of candidateEndpoints) {
      try {
        const res = await axios.get(ep);
        const data = res.data;
        if (Array.isArray(data.categories)) {
          categoriesArray = data.categories;
          detectedEndpoints.push(ep);
        }
        if (Array.isArray(data.items)) {
          itemsArray = data.items;
          detectedEndpoints.push(ep);
        }
      } catch (err) {}
    }
    const hasPriceField = itemsArray.some(i => 'price' in i);
    if (Array.isArray(itemsArray) && Array.isArray(categoriesArray) && hasPriceField && itemsArray.length > 20) {
      apiDetected = true;
      autoRoutedAdapter = 'genericRestMenuApiAdapter';
      adapter = async (args) => genericRestMenuApiAdapter({ endpoints: detectedEndpoints });
      extractionStrategy = 'api-direct';
      menuPlatform = 'api-direct';
    } else {
      switch (menuPlatform) {
        case 'toast':
          adapter = toastAdapter;
          break;
        case 'focuspos':
          adapter = focusPosAdapter;
          break;
        case 'bentobox':
          adapter = bentoBoxAdapter;
          break;
        case 'pdf':
          adapter = adapter;
          break;
        case 'static':
          adapter = staticHtmlAdapter;
          break;
        case 'custom-html':
        case 'unknown':
        default:
          adapter = staticHtmlAdapter;
          break;
      }
    }
    pipelineStageReport.siteType = menuPlatform;
    pipelineStageReport.apiDetected = apiDetected;
    pipelineStageReport.adapterUsed = autoRoutedAdapter || (adapter && adapter.name) || null;
  }
  pipelineStageReport.siteType = menuPlatform;
  pipelineStageReport.apiDetected = apiDetected;
  pipelineStageReport.adapterUsed = autoRoutedAdapter || (adapter && adapter.name) || null;
  pipelineStageReport.siteType = menuPlatform;
  pipelineStageReport.apiDetected = apiDetected;
  pipelineStageReport.adapterUsed = autoRoutedAdapter || (adapter && adapter.name) || null;
  if (!adapter) {
    console.log("EARLY_RETURN_TRIGGERED");
    console.log("[ADAPTER_ERROR]", { platform: menuPlatform });
    return buildRestaurantResult({
      name: restaurant.name,
      menuUrl: currentUrl,
      menuPlatform,
      extractionStrategy,
      items: 0,
      sections: 0,
      confidence: 0,
      reason: "No adapter found for detected menu platform",
      elapsedMs: null
    });
  }
  adapterResult = await adapter({ html, headers, scripts, restaurant });

  // Defensive: check for undefined/null adapter return
  if (!adapterResult) {
    pipelineStageReport.OUTCOME_TYPE = 'NO_DATA';
    pipelineStageReport.totalSections = 0;
    pipelineStageReport.totalItems = 0;
    pipelineStageReport.priceDensity = 0;
    pipelineStageReport.confidence = 0;
    console.log(JSON.stringify(pipelineStageReport));
    return buildRestaurantResult({
      name: restaurant.name,
      menuUrl: currentUrl,
      menuPlatform,
      extractionStrategy,
      items: 0,
      sections: 0,
      confidence: 0,
      reason: "ADAPTER_RETURNED_UNDEFINED",
      elapsedMs: null
    });
  }

  // Contract validator: ensure sections is array
  if (!Array.isArray(adapterResult.sections)) {
    pipelineStageReport.OUTCOME_TYPE = 'NO_DATA';
    pipelineStageReport.totalSections = 0;
    pipelineStageReport.totalItems = 0;
    pipelineStageReport.priceDensity = 0;
    pipelineStageReport.confidence = 0;
    console.log(JSON.stringify(pipelineStageReport));
  }

  // --- REBUILT CONFIDENCE FORMULA ---
  let items = 0;
  sections = 0;
  if (Array.isArray(adapterResult.sections)) {
    sections = adapterResult.sections.length;
    items = adapterResult.sections.reduce((acc, sec) => acc + (Array.isArray(sec.items) ? sec.items.length : 0), 0);
  }
  let priceDensity = 0;
  if (items > 0 && html) {
    const priceRegex = /(?:\$\s*)?(\d{1,3}(?:\.\d{2})?|\d{1,3}\.|\.\d{2})/g;
    const spanPriceRegex = /<span[^>]*class=["'][^"']*(price|menu-item-price|item-price)[^"']*["'][^>]*>([^<]+)<\/span>/gi;
    let priceMatches = 0;
    let match;
    while ((match = priceRegex.exec(html)) !== null) {
      priceMatches++;
    }
    while ((match = spanPriceRegex.exec(html)) !== null) {
      priceMatches++;
    }
    priceDensity = priceMatches / items;
  }
  let structuredSignals = 0;
  if (sections > 0) structuredSignals += 1;
  if (items > 10) structuredSignals += 1;
  if (priceDensity > 0.2) structuredSignals += 1;
  let finalConfidence = 0;
  if (items === 0) {
    finalConfidence = 0;
  } else if (items > 10 && priceDensity > 0.2 && structuredSignals >= 2) {
    finalConfidence = Math.min(100, 60 + (structuredSignals - 2) * 20);
  } else if (items > 5 && priceDensity > 0.15 && structuredSignals >= 2) {
    finalConfidence = 40;
  } else {
    finalConfidence = 10;
  }
  if (finalConfidence > 100) finalConfidence = 100;
  if (!(items > 10 && priceDensity > 0.2 && structuredSignals >= 2) && finalConfidence > 60) {
    finalConfidence = 60;
  }
  pipelineStageReport.totalSections = sections;
  pipelineStageReport.totalItems = items;
  pipelineStageReport.priceDensity = priceDensity;
  pipelineStageReport.confidence = finalConfidence;
  pipelineStageReport.twoHopUsed = typeof twoHopUsed !== 'undefined' ? twoHopUsed : false;
  // Extraction Outcome Classifier
  if (pipelineStageReport.skipped) {
    pipelineStageReport.OUTCOME_TYPE = 'SKIPPED';
  } else if (finalConfidence >= 80) {
    pipelineStageReport.OUTCOME_TYPE = 'HIGH_CONFIDENCE_STRUCTURED';
  } else if (finalConfidence >= 40) {
    pipelineStageReport.OUTCOME_TYPE = 'MEDIUM_CONFIDENCE';
  } else if (finalConfidence >= 1) {
    pipelineStageReport.OUTCOME_TYPE = 'LOW_CONFIDENCE';
  } else {
    pipelineStageReport.OUTCOME_TYPE = 'NO_DATA';
  }
  console.log(JSON.stringify(pipelineStageReport));

  // --- FAILURE REASON FIELD ---
    // Fallback: If structured extraction found nothing or confidenceScore < 0.3, run ModernLayoutStrategy
    fallbackTriggered = false;
    fallbackSections = [];
      if (out.menu_sections.length === 0 || finalConfidence < 0.3) {
        fallbackTriggered = true;
        console.log(`[STRATEGY_PIVOT]: Primary failed (Score: ${finalConfidence}), switching to ModernLayoutStrategy.`);
        const modernStrategy = new ModernLayoutStrategy(page);
        fallbackSections = await modernStrategy.extractMenuSections();
        if (fallbackSections.length) out.menu_sections = fallbackSections;
        // Assign fallback extraction results to shared summary variables
        totalSections = fallbackSections.length;
        itemsPerSection = fallbackSections.map(sec => Array.isArray(sec.items) ? sec.items.length : 0);
        totalItems = itemsPerSection.reduce((acc, n) => acc + n, 0);
        first3Items = [];
        sample_alignment = [];
        for (let sec of fallbackSections) {
          if (Array.isArray(sec.items)) {
            for (let item of sec.items) {
              if (first3Items.length < 3) {
                first3Items.push(item);
                let fragment = null;
                if (item.name) {
                  const regex = new RegExp(item.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
                  const match = html.match(regex);
                  if (match) {
                    const idx = match.index;
                    fragment = html.substring(Math.max(0, idx - 75), Math.min(html.length, idx + 75));
                  }
                }
                sample_alignment.push({
                  name: item.name,
                  price: item.price,
                  description: item.description,
                  raw_text_fragment: fragment || 'N/A'
                });
              }
            }
          }
          if (first3Items.length >= 3) break;
        }
        summaryObject.totalSections = totalSections;
        summaryObject.totalItems = totalItems;
        summaryObject.itemsPerSection = itemsPerSection;
        summaryObject.first3Items = first3Items;
        summaryObject.sample_alignment = sample_alignment;
      }
  let reason = adapterResult.reason || null;
  if (items === 0 && !reason) {
    reason = "No structured menu data detected after platform routing";
  }

  // Structured JSON summary log
  itemsPerSection = Array.isArray(adapterResult.sections)
    ? adapterResult.sections.map(sec => Array.isArray(sec.items) ? sec.items.length : 0)
    : [];
  first3Items = [];
  sample_alignment = [];
  if (Array.isArray(adapterResult.sections)) {
    for (let sec of adapterResult.sections) {
      if (Array.isArray(sec.items)) {
        for (let item of sec.items) {
          if (first3Items.length < 3) {
            first3Items.push(item);
            // Find raw_text_fragment (150 chars) from HTML
            let fragment = null;
            if (item.name) {
              const regex = new RegExp(item.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
              const match = html.match(regex);
              if (match) {
                const idx = match.index;
                fragment = html.substring(Math.max(0, idx - 75), Math.min(html.length, idx + 75));
              }
            }
            sample_alignment.push({
              name: item.name,
              price: item.price,
              description: item.description,
              raw_text_fragment: fragment || 'N/A'
            });
          }
        }
      }
      if (first3Items.length >= 3) break;
    }
  }
  let parsingWarnings = [];
  if (items === 0) parsingWarnings.push("No menu items extracted");
  if (sections === 0) parsingWarnings.push("No menu sections detected");
  if (priceDensity < 0.15) parsingWarnings.push("Low price density");
  if (finalConfidence < 40) parsingWarnings.push("Low confidence score");
  const summaryObject = {
    totalSections: sections,
    totalItems: items,
    itemsPerSection,
    first3Items,
    priceDensity,
    confidenceScore: finalConfidence,
    parsingWarnings,
    sample_alignment
  }
  console.log("MENU_EXTRACTION_SUMMARY", JSON.stringify(summaryObject, null, 2));
  try { if (browser) await browser.close(); } catch (e) {}
  // Canonical result
  return buildRestaurantResult({
    name: restaurant.name,
    menuUrl: currentUrl,
    menuPlatform,
    extractionStrategy,
    items,
    sections,
    confidence: finalConfidence,
    reason,
    elapsedMs: null
  });
}

export default menuScraperAgent;
