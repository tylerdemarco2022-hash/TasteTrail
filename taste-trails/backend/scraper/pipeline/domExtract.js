/**
 * DOM Heuristics Extraction Engine
 *
 * Extracts menu items from HTML using DOM structure heuristics:
 * - Section grouping via headings (h2/h3/aria)
 * - Item detection via price regex + name sanity + description proximity
 * - Deduplication and footer/nav junk filtering
 * - Logs candidate rejection reasons
 */

import { parse } from 'node-html-parser';

const PRICE_REGEX = /\$\s?(\d{1,3}(?:\.\d{2})?)/;
const PRICE_ANYWHERE_REGEX = /(\d{1,3}(?:\.\d{2}))/;
const NAV_FOOTER_REGEX = /privacy|terms|cookie|careers|facebook|instagram|twitter|youtube|copyright|all rights reserved|accessibility|sign\s*up|log\s*in|newsletter/i;
const NOISE_REGEX = /^(home|about|contact|menu|gallery|events|careers|blog|press|faq|hours|directions|reservation|gift\s*card)$/i;
const MODIFIER_REGEX = /^(with|add|extra|choice of|served with|substitute|upgrade|side of)\b/i;
const SECTION_HEADING_REGEX = /^(appetizers?|starters?|small plates?|shared|soups?(?:\s*&\s*salads?)?|salads?|sandwiches?|burgers?|tacos?|entrees?|mains?|pastas?|pizzas?|sides?|desserts?|beverages?|drinks?|cocktails?|wine|beer|brunch|lunch|dinner|kids?|specials?)$/i;

function normalizeText(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }

function normalizePrice(text) {
  if (!text) return null;
  const match = String(text).match(PRICE_REGEX);
  if (match) return parseFloat(match[1]);
  const numMatch = String(text).match(PRICE_ANYWHERE_REGEX);
  return numMatch ? parseFloat(numMatch[1]) : null;
}

function isJunkText(text) {
  if (!text) return true;
  if (text.length < 2 || text.length > 120) return true;
  if (NAV_FOOTER_REGEX.test(text)) return true;
  if (NOISE_REGEX.test(text)) return true;
  if (MODIFIER_REGEX.test(text)) return true;
  if (!/[a-z]/i.test(text)) return true;
  // Phone numbers
  if (/\d{3}[.\-\s]?\d{3}[.\-\s]?\d{2,4}/.test(text)) return true;
  return false;
}

function normalizeSectionName(text) {
  return normalizeText(text).replace(/[:\-]+$/, '').trim();
}

function isLikelySectionHeading(text) {
  const clean = normalizeSectionName(text);
  if (!clean) return false;
  if (clean.length < 3 || clean.length > 48) return false;
  if (PRICE_REGEX.test(clean)) return false;
  if (isJunkText(clean)) return false;
  if (SECTION_HEADING_REGEX.test(clean)) return true;

  const words = clean.split(/\s+/);
  const isUppercaseHeading = clean === clean.toUpperCase() && /[A-Z]/.test(clean);
  return isUppercaseHeading && words.length <= 5;
}

function pushSection(sections, sectionSeen, sectionName) {
  const clean = normalizeSectionName(sectionName);
  if (!isLikelySectionHeading(clean)) return;
  const key = clean.toLowerCase();
  if (sectionSeen.has(key)) return;
  sectionSeen.add(key);
  sections.push(clean);
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/&aacute;|&eacute;|&iacute;|&oacute;|&uacute;/gi, '')
    .replace(/&[a-z]+;/gi, ' ');
}

function stripTags(text) {
  return String(text || '').replace(/<[^>]+>/g, ' ');
}

function parseTrailingPrice(text) {
  const clean = normalizeText(text);
  if (!clean) return null;

  const currency = clean.match(/\$\s?(\d{1,3}(?:\.\d{2})?)\s*$/);
  if (currency) return parseFloat(currency[1]);

  const trailing = clean.match(/(\d{1,3}(?:\.\d{2})?)\s*$/);
  if (!trailing) return null;
  const value = parseFloat(trailing[1]);
  if (!Number.isFinite(value) || value < 2 || value > 250) return null;
  return value;
}

function parseTailDescriptionAndPrice(rawTail = '') {
  const normalizedTail = normalizeText(decodeHtmlEntities(stripTags(rawTail)));
  if (!normalizedTail) return { description: '', price: null };

  const price = parseTrailingPrice(normalizedTail);
  if (!price) return { description: normalizedTail, price: null };

  const description = normalizeText(
    normalizedTail.replace(/(?:\$\s?)?\d{1,3}(?:\.\d{2})?\s*$/, '')
  );
  return { description, price };
}

function extractStrongSectionItems(root, sections, sectionSeen, items, seen, rejectionReasons) {
  if (!root) return;
  const headingNodes = root.querySelectorAll('h2, h3, h4');

  for (const heading of headingNodes) {
    const sectionHeading = normalizeSectionName(heading?.text || '');
    if (!isLikelySectionHeading(sectionHeading)) continue;
    pushSection(sections, sectionSeen, sectionHeading);

    let sibling = heading.nextElementSibling;
    let hopCount = 0;
    while (sibling && hopCount < 8) {
      hopCount += 1;
      const tag = String(sibling.rawTagName || '').toLowerCase();
      if (/^h[1-6]$/.test(tag)) break;

      const sectionBody = String(sibling.innerHTML || '');
      if (!sectionBody || !/<strong/i.test(sectionBody)) {
        sibling = sibling.nextElementSibling;
        continue;
      }

      const itemRegex = /<strong[^>]*>([\s\S]*?)<\/strong>([\s\S]*?)(?=<strong[^>]*>|$)/gi;
      let itemMatch;
      while ((itemMatch = itemRegex.exec(sectionBody)) !== null) {
        const rawName = decodeHtmlEntities(stripTags(itemMatch[1]));
        const name = normalizeText(rawName).replace(/[*•]+/g, '').trim();
        if (!name || isJunkText(name)) {
          rejectionReasons.junkName++;
          continue;
        }

        const { description, price } = parseTailDescriptionAndPrice(itemMatch[2] || '');
        const key = `${name.toLowerCase()}|${price ?? ''}`;
        if (seen.has(key)) {
          rejectionReasons.duplicate++;
          continue;
        }
        seen.add(key);

        items.push({ name, description, price, section_name: sectionHeading });
      }

      sibling = sibling.nextElementSibling;
    }
  }
}

function extractLinePriceInfo(text) {
  const source = String(text || '');
  if (!source) return null;

  const withCurrency = source.match(/\$\s?(\d{1,3}(?:\.\d{2})?)/);
  if (withCurrency) {
    return {
      price: parseFloat(withCurrency[1]),
      index: withCurrency.index,
      matchText: withCurrency[0]
    };
  }

  const trailing = source.match(/(\d{1,3}(?:\.\d{2})?)\s*$/);
  if (!trailing) return null;
  const value = parseFloat(trailing[1]);
  if (!Number.isFinite(value) || value < 2 || value > 250) return null;

  const trailingIndex = source.lastIndexOf(trailing[1]);
  if (trailingIndex < 0) return null;

  return {
    price: value,
    index: trailingIndex,
    matchText: trailing[1]
  };
}

/**
 * Extract menu items from raw HTML string using DOM heuristics.
 * @param {string} html - Raw or rendered HTML
 * @returns {{ sections: string[], items: Array, rejectionReasons: object }}
 */
export function extractDomItems(html) {
  if (!html || typeof html !== 'string') {
    return { sections: [], items: [], rejectionReasons: { noHtml: 1 } };
  }

  const root = parse(html);
  const sections = [];
  const items = [];
  const rejectionReasons = { missingName: 0, missingPrice: 0, junkName: 0, tooLong: 0, modifier: 0, duplicate: 0 };
  const seen = new Set();
  const sectionSeen = new Set();

  // â”€â”€ Extract section headings â”€â”€
  const headingEls = root.querySelectorAll('h1, h2, h3, h4, [role="heading"], [class*="section-title"], [class*="sectionTitle"], [class*="category-name"], [class*="categoryName"]');
  for (const el of headingEls) {
    pushSection(sections, sectionSeen, el.text);
  }

  // Strategy 0: parse heading + strong-tag blocks (common on WordPress/Avada menus)
  extractStrongSectionItems(root, sections, sectionSeen, items, seen, rejectionReasons);

  // â”€â”€ Strategy 1: Structured menu containers â”€â”€
  const menuContainerSelectors = [
    '[data-menu-item]',
    '.menu-item', '[class*="menu-item"]', '[class*="menu_item"]',
    '.dish', '[class*="dish"]',
    '.menu-entry', '[class*="menu-entry"]',
    '[class*="food-item"]', '[class*="foodItem"]',
  ];

  const containerNodes = root.querySelectorAll(menuContainerSelectors.join(','));
  for (const node of containerNodes.slice(0, 500)) {
    const nameEl = node.querySelector('[class*="name"], [class*="title"], h3, h4, h5, strong, b');
    const priceEl = node.querySelector('[class*="price"]');
    const descEl = node.querySelector('[class*="desc"], [class*="description"], p');

    const name = normalizeText(nameEl?.text || '');
    const priceText = normalizeText(priceEl?.text || node.text || '');
    const price = normalizePrice(priceText);
    const description = normalizeText(descEl?.text || '');

    if (!name || isJunkText(name)) { rejectionReasons.junkName++; continue; }
    if (!price) { rejectionReasons.missingPrice++; continue; }

    const key = `${name.toLowerCase()}|${price}`;
    if (seen.has(key)) { rejectionReasons.duplicate++; continue; }
    seen.add(key);

    // Find nearest section heading
    let sectionName = 'Menu';
    let parent = node.parentNode;
    for (let i = 0; i < 5 && parent; i++) {
      const heading = parent.querySelector('h2, h3, [class*="section-title"], [class*="category-name"]');
      if (heading) {
        const hText = normalizeText(heading.text);
        if (isLikelySectionHeading(hText)) {
          sectionName = normalizeSectionName(hText);
          pushSection(sections, sectionSeen, sectionName);
          break;
        }
      }
      parent = parent.parentNode;
    }

    items.push({ name, description, price, section_name: sectionName });
  }

  // â”€â”€ Strategy 2: Line-by-line price scanning (fallback) â”€â”€
  if (items.length < 8) {
    const body = root.querySelector('body');
    if (body) {
      const rawBodyText = String(body.text || '').replace(/\r/g, '\n');
      const lines = rawBodyText.split(/\n+/).map((line) => normalizeText(line)).filter(Boolean);
      let currentSection = sections[0] || 'Menu';

      for (const line of lines) {
        const trimmed = normalizeText(line);
        if (!trimmed || trimmed.length > 200) continue;

        if (isLikelySectionHeading(trimmed)) {
          currentSection = normalizeSectionName(trimmed);
          pushSection(sections, sectionSeen, currentSection);
          continue;
        }

        const priceInfo = extractLinePriceInfo(trimmed);
        if (!priceInfo) continue;

        const beforePrice = normalizeText(trimmed.slice(0, priceInfo.index));
        const price = priceInfo.price;

        if (!beforePrice || isJunkText(beforePrice)) { rejectionReasons.junkName++; continue; }
        if (beforePrice.length > 80) { rejectionReasons.tooLong++; continue; }

        const key = `${beforePrice.toLowerCase()}|${price}`;
        if (seen.has(key)) { rejectionReasons.duplicate++; continue; }
        seen.add(key);

        items.push({ name: beforePrice, description: '', price, section_name: currentSection || 'Menu' });
      }
    }
  }

  return { sections, items, rejectionReasons };
}

