/**
 * Provider Adapters
 *
 * Each adapter fetches structured menu data from a known provider's API or HTML structure.
 * All return normalized arrays of { name, description, price, section_name }.
 */

import { parse } from 'node-html-parser';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function normalizeText(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
function normalizePrice(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const match = String(v).match(/(\d{1,3}(?:\.\d{2})?)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Toast adapter — scrapes the ToastTab menu page.
 * Toast embeds menu data in JSON-LD and also in structured divs.
 */
async function fetchToastMenu(url, html) {
  const items = [];
  const root = parse(html);

  // Toast uses .menuGroup and .menuItem classes
  const groups = root.querySelectorAll('.menuGroup, [class*="menu-group"], [class*="menuGroup"]');
  for (const group of groups) {
    const sectionEl = group.querySelector('h2, h3, .groupTitle, [class*="group-title"], [class*="groupTitle"]');
    const sectionName = normalizeText(sectionEl?.text) || 'Menu';

    const menuItems = group.querySelectorAll('.menuItem, [class*="menu-item"], [class*="menuItem"]');
    for (const item of menuItems) {
      const nameEl = item.querySelector('.itemName, [class*="item-name"], [class*="itemName"], h3, h4');
      const priceEl = item.querySelector('.itemPrice, [class*="item-price"], [class*="itemPrice"], [class*="price"]');
      const descEl = item.querySelector('.itemDescription, [class*="item-desc"], [class*="itemDesc"]');

      const name = normalizeText(nameEl?.text);
      if (!name || name.length < 2) continue;

      items.push({
        name,
        description: normalizeText(descEl?.text),
        price: normalizePrice(priceEl?.text),
        section_name: sectionName
      });
    }
  }

  return items;
}

/**
 * Square adapter — Square Online stores use structured HTML menus.
 */
async function fetchSquareMenu(url, html) {
  const items = [];
  const root = parse(html);

  const sections = root.querySelectorAll('[class*="category"], [class*="section"]');
  for (const section of sections) {
    const headingEl = section.querySelector('h2, h3, [class*="category-name"], [class*="section-title"]');
    const sectionName = normalizeText(headingEl?.text) || 'Menu';

    const itemEls = section.querySelectorAll('[class*="item"], [class*="product"]');
    for (const el of itemEls) {
      const nameEl = el.querySelector('[class*="item-name"], [class*="product-name"], h3, h4');
      const priceEl = el.querySelector('[class*="price"]');
      const descEl = el.querySelector('[class*="description"], [class*="desc"]');

      const name = normalizeText(nameEl?.text);
      if (!name || name.length < 2) continue;

      items.push({
        name,
        description: normalizeText(descEl?.text),
        price: normalizePrice(priceEl?.text),
        section_name: sectionName
      });
    }
  }

  return items;
}

/**
 * Clover adapter
 */
async function fetchCloverMenu(url, html) {
  const items = [];
  const root = parse(html);

  const categories = root.querySelectorAll('[class*="category"], [class*="menu-category"]');
  for (const cat of categories) {
    const headingEl = cat.querySelector('h2, h3, [class*="category-name"]');
    const sectionName = normalizeText(headingEl?.text) || 'Menu';

    const itemEls = cat.querySelectorAll('[class*="item"], [class*="menu-item"]');
    for (const el of itemEls) {
      const nameEl = el.querySelector('[class*="name"], h3, h4, strong');
      const priceEl = el.querySelector('[class*="price"]');
      const descEl = el.querySelector('[class*="desc"]');

      const name = normalizeText(nameEl?.text);
      if (!name || name.length < 2) continue;

      items.push({
        name,
        description: normalizeText(descEl?.text),
        price: normalizePrice(priceEl?.text),
        section_name: sectionName
      });
    }
  }

  return items;
}

/**
 * ChowNow adapter — ChowNow embeds menu data in __NEXT_DATA__ or API calls.
 */
async function fetchChowNowMenu(url, html) {
  const items = [];

  // Try __NEXT_DATA__ first
  const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1].replace(/[\u0000-\u001F\u007F]/g, ''));
      const props = data?.props?.pageProps;
      if (props?.menu || props?.menuItems || props?.categories) {
        const menu = props.menu || props;
        const categories = menu.categories || menu.sections || [];
        for (const cat of Array.isArray(categories) ? categories : []) {
          const sectionName = normalizeText(cat.name || cat.title) || 'Menu';
          for (const item of Array.isArray(cat.items) ? cat.items : []) {
            const name = normalizeText(item.name || item.title);
            if (!name) continue;
            items.push({
              name,
              description: normalizeText(item.description),
              price: normalizePrice(item.price || item.base_price),
              section_name: sectionName
            });
          }
        }
      }
    } catch (_) {}
  }

  // Fallback to DOM parsing
  if (items.length < 5) {
    const root = parse(html);
    const itemEls = root.querySelectorAll('[class*="menu-item"], [class*="menuItem"]');
    for (const el of itemEls) {
      const nameEl = el.querySelector('[class*="name"], h3, h4');
      const priceEl = el.querySelector('[class*="price"]');
      const name = normalizeText(nameEl?.text);
      if (!name) continue;
      items.push({
        name,
        description: '',
        price: normalizePrice(priceEl?.text),
        section_name: 'Menu'
      });
    }
  }

  return items;
}

/**
 * BentoBox adapter — BentoBox uses structured HTML with data attributes.
 */
async function fetchBentoBoxMenu(url, html) {
  const items = [];
  const root = parse(html);

  const sections = root.querySelectorAll('[class*="menu-section"], [class*="menuSection"], .menu-category');
  for (const section of sections) {
    const headingEl = section.querySelector('h2, h3, [class*="section-title"], [class*="sectionTitle"]');
    const sectionName = normalizeText(headingEl?.text) || 'Menu';

    const itemEls = section.querySelectorAll('[class*="menu-item"], [class*="menuItem"]');
    for (const el of itemEls) {
      const nameEl = el.querySelector('[class*="item-title"], [class*="itemTitle"], [class*="name"], h3, h4');
      const priceEl = el.querySelector('[class*="price"]');
      const descEl = el.querySelector('[class*="description"], [class*="desc"]');

      const name = normalizeText(nameEl?.text);
      if (!name || name.length < 2) continue;

      items.push({
        name,
        description: normalizeText(descEl?.text),
        price: normalizePrice(priceEl?.text),
        section_name: sectionName
      });
    }
  }

  return items;
}

/**
 * Popmenu adapter — Popmenu uses React with __NEXT_DATA__ or structured classes.
 */
async function fetchPopmenuMenu(url, html) {
  const items = [];

  // Try extracting from Popmenu's app state
  const stateMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i) ||
    html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);

  if (stateMatch) {
    try {
      const data = JSON.parse(stateMatch[1].replace(/[\u0000-\u001F\u007F]/g, ''));
      // Walk the state object looking for menu items
      const walk = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) { obj.forEach(walk); return; }

        const name = normalizeText(obj.name || obj.title || obj.dishName || '');
        const price = normalizePrice(obj.price || obj.amount || obj.displayPrice);
        if (name && name.length >= 2 && (price || obj.description)) {
          items.push({
            name,
            description: normalizeText(obj.description || ''),
            price,
            section_name: normalizeText(obj.category || obj.section || obj.menuSection || 'Menu')
          });
        }

        for (const val of Object.values(obj)) {
          if (typeof val === 'object' && val !== null && items.length < 500) walk(val);
        }
      };
      walk(data);
    } catch (_) {}
  }

  // Fallback DOM extraction
  if (items.length < 5) {
    const root = parse(html);
    const itemEls = root.querySelectorAll('[class*="menu-item"], [class*="dish"], [class*="pm-menu"]');
    for (const el of itemEls) {
      const nameEl = el.querySelector('[class*="name"], [class*="title"], h3, h4');
      const priceEl = el.querySelector('[class*="price"]');
      const name = normalizeText(nameEl?.text);
      if (!name) continue;
      items.push({ name, description: '', price: normalizePrice(priceEl?.text), section_name: 'Menu' });
    }
  }

  return items;
}

const ADAPTER_MAP = {
  Toast: fetchToastMenu,
  Square: fetchSquareMenu,
  Clover: fetchCloverMenu,
  ChowNow: fetchChowNowMenu,
  BentoBox: fetchBentoBoxMenu,
  Popmenu: fetchPopmenuMenu,
};

/**
 * Main entry: dispatch to the correct provider adapter.
 * @param {string} provider - Provider name from detectProvider()
 * @param {string} url - The menu URL
 * @param {string} html - The fetched HTML
 * @returns {Array} Normalized menu items
 */
export async function fetchProviderMenu(provider, url, html) {
  const adapter = ADAPTER_MAP[provider];
  if (!adapter) {
    console.warn(`[providerAdapters] No adapter for provider: ${provider}`);
    return [];
  }
  return adapter(url, html);
}
