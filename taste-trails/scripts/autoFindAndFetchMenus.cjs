const fs = require('fs');
const path = require('path');

const LOCATION = 'Charlotte, NC';
const MIN_ITEMS = 8; // consider menu missing if fewer than this
const OPENAI_MODEL = 'gpt-4o-mini';

const RESTAURANTS_DIR = path.join(__dirname, '../backend/restaurants');
const OUTPUT_REPORT = path.join(__dirname, '../menu-url-auto-report.json');

const BLOCKLIST_DOMAINS = [
  'facebook.com',
  'm.facebook.com',
  'yelp.com',
  'doordash.com',
  'ubereats.com',
  'grubhub.com',
  'tripadvisor.com',
  'opentable.com',
  'google.com',
  'maps.google.com',
  'duckduckgo.com'
];

const ALLOWLIST_DOMAINS = [
  'singleplatform.com',
  'popmenu.com',
  'toasttab.com',
  'clover.com',
  'chownow.com',
  'square.site',
  'bentobox.com',
  'menufy.com',
  'order.online',
  'order.store',
  'olo.com',
  'mryum.com',
  'toasttab.com'
];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return null;
  }
}

function countMenuItems(menuJson) {
  if (!menuJson) return 0;
  if (Array.isArray(menuJson)) return menuJson.length;
  if (menuJson.items && Array.isArray(menuJson.items)) return menuJson.items.length;
  if (menuJson.categories && Array.isArray(menuJson.categories)) {
    return menuJson.categories.reduce((sum, cat) => sum + (cat.items ? cat.items.length : 0), 0);
  }
  return 0;
}

function listRestaurantsNeedingMenus() {
  const entries = fs.readdirSync(RESTAURANTS_DIR, { withFileTypes: true });
  const needs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(RESTAURANTS_DIR, entry.name);
    const menuFile = path.join(dirPath, 'menu.json');
    const menuJson = fs.existsSync(menuFile) ? readJson(menuFile) : null;
    const count = countMenuItems(menuJson);
    if (count < MIN_ITEMS) {
      needs.push({ name: entry.name, menuFile, count });
    }
  }
  return needs;
}

function normalizeRestaurantName(dirName) {
  return dirName
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bFort\b/gi, 'Ft')
    .trim();
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildPlatformUrls(restaurantName, location) {
  const slug = slugify(restaurantName);
  const city = slugify(location.split(',')[0] || location);
  const urls = [
    // SinglePlatform
    `https://www.singleplatform.com/${slug}/menu`,
    `https://singleplatform.com/${slug}/menu`,
    // Popmenu
    `https://www.${slug}.popmenu.com`,
    `https://${slug}.popmenu.com`,
    // ToastTab
    `https://www.toasttab.com/${slug}/menu`,
    `https://www.toasttab.com/${slug}`,
    // Clover
    `https://www.clover.com/online-ordering/${slug}-${city}`,
    // ChowNow
    `https://order.chownow.com/order/locations/${slug}`,
    // Square
    `https://${slug}.square.site`,
    // BentoBox
    `https://${slug}.bentobox.com`,
    // Menufy
    `https://www.menufy.com/${slug}`
  ];
  return uniqueUrls(urls);
}

function unwrapDuckDuckGoUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'duckduckgo.com' && parsed.pathname.startsWith('/l/')) {
      const uddg = parsed.searchParams.get('uddg');
      if (uddg) return decodeURIComponent(uddg);
    }
  } catch (err) {
    return url;
  }
  return url;
}

function isBlocked(url) {
  try {
    const parsed = new URL(url);
    return BLOCKLIST_DOMAINS.some(domain => parsed.hostname.endsWith(domain));
  } catch (err) {
    return true;
  }
}

function isAllowlisted(url) {
  try {
    const parsed = new URL(url);
    return ALLOWLIST_DOMAINS.some(domain => parsed.hostname.endsWith(domain));
  } catch (err) {
    return false;
  }
}

function matchesRestaurantSlug(url, restaurantName) {
  const slug = slugify(restaurantName);
  return url.toLowerCase().includes(slug);
}

function filterCandidateUrls(urls, restaurantName) {
  const filtered = [];
  for (const url of urls) {
    if (!url) continue;
    const clean = unwrapDuckDuckGoUrl(url);
    if (isBlocked(clean)) continue;
    if (isAllowlisted(clean) || matchesRestaurantSlug(clean, restaurantName)) {
      filtered.push(clean);
    }
  }
  return uniqueUrls(filtered);
}

function uniqueUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const url of urls) {
    if (!url || typeof url !== 'string') continue;
    const clean = url.split('#')[0];
    if (seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

async function fetchText(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractJsonLd(html) {
  const items = [];
  const scripts = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const script of scripts) {
    const jsonText = script.replace(/^[\s\S]*?>/i, '').replace(/<\/script>$/i, '');
    try {
      const data = JSON.parse(jsonText);
      const candidates = Array.isArray(data) ? data : [data];
      for (const obj of candidates) {
        if (!obj) continue;
        const menu = obj.hasMenu || obj.menu || obj.hasMenuSection;
        if (!menu) continue;
        const sections = obj.hasMenuSection || (Array.isArray(menu) ? menu : menu.hasMenuSection) || [];
        for (const section of sections) {
          const sectionName = section.name || 'Menu';
          const menuItems = section.hasMenuItem || [];
          for (const item of menuItems) {
            if (!item || !item.name) continue;
            items.push({
              name: item.name,
              description: item.description || '',
              category: sectionName
            });
          }
        }
      }
    } catch (err) {
      // ignore parse errors
    }
  }
  return items;
}

function collectMenuLikeItems(node, items, seen, depth = 0) {
  if (!node || depth > 10) return;
  if (Array.isArray(node)) {
    for (const item of node) {
      collectMenuLikeItems(item, items, seen, depth + 1);
    }
    return;
  }
  if (typeof node !== 'object') return;

  const name = node.name || node.title || node.itemName;
  const description = node.description || node.desc || node.itemDescription || '';
  const category = node.category || node.section || node.sectionName || node.menuSection || 'Menu';
  const price = node.price || node.basePrice || node.itemPrice || node.priceAmount;

  if (typeof name === 'string' && name.trim().length > 2 && !seen.has(name)) {
    items.push({ name: name.trim(), description: String(description || '').trim(), category, price });
    seen.add(name);
  }

  for (const value of Object.values(node)) {
    collectMenuLikeItems(value, items, seen, depth + 1);
  }
}

function extractEmbeddedJson(html) {
  const blobs = [];

  // application/json or Next.js data
  const scriptMatches = html.match(/<script[^>]*(type="application\/json"|id="__NEXT_DATA__")[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const script of scriptMatches) {
    const jsonText = script.replace(/^[\s\S]*?>/i, '').replace(/<\/script>$/i, '').trim();
    if (!jsonText) continue;
    blobs.push(jsonText);
  }

  // common window assignments
  const assigns = [
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/gi,
    /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/gi,
    /window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*?\});/gi
  ];
  for (const re of assigns) {
    let match;
    while ((match = re.exec(html)) !== null) {
      if (match[1]) blobs.push(match[1]);
    }
  }

  return blobs;
}

function extractMenuItemsFromHtml(html) {
  const items = [];
  const seen = new Set();

  // JSON-LD first
  for (const item of extractJsonLd(html)) {
    if (!seen.has(item.name)) {
      items.push(item);
      seen.add(item.name);
    }
  }

  // Embedded JSON blobs
  const jsonBlobs = extractEmbeddedJson(html);
  for (const blob of jsonBlobs) {
    try {
      const data = JSON.parse(blob);
      collectMenuLikeItems(data, items, seen);
    } catch (err) {
      // ignore parse errors
    }
  }

  // Simple list item fallback
  const liRegex = /<li[^>]*>([^<]{3,120})<\/li>/gi;
  let match;
  while ((match = liRegex.exec(html)) !== null) {
    const name = match[1].trim();
    if (!seen.has(name) && /[a-zA-Z]/.test(name)) {
      items.push({ name, description: '', category: 'Menu' });
      seen.add(name);
    }
  }

  // Name + description blocks
  const blockRegex = /<h[2-4][^>]*>([^<]{3,120})<\/h[2-4]>\s*<p[^>]*>([^<]{0,200})<\/p>/gi;
  while ((match = blockRegex.exec(html)) !== null) {
    const name = match[1].trim();
    if (!seen.has(name)) {
      items.push({ name, description: match[2].trim(), category: 'Menu' });
      seen.add(name);
    }
  }

  // Common menu item class patterns
  const nameRegexes = [
    /class="[^"]*(menu-item-name|item-name|dish-name|menuItem-name)[^"]*"[^>]*>([^<]{3,140})<\/[^>]+>/gi,
    /class="[^"]*(menu-item|menuItem|menu__item|menu-item__name)[^"]*"[^>]*>([^<]{3,140})<\/[^>]+>/gi
  ];
  for (const re of nameRegexes) {
    while ((match = re.exec(html)) !== null) {
      const name = (match[2] || '').trim();
      if (name && !seen.has(name)) {
        items.push({ name, description: '', category: 'Menu' });
        seen.add(name);
      }
    }
  }

  const descRegex = /class="[^"]*(menu-item-description|item-description|dish-description)[^"]*"[^>]*>([^<]{3,220})<\/[^>]+>/gi;
  while ((match = descRegex.exec(html)) !== null) {
    const description = (match[2] || '').trim();
    const last = items[items.length - 1];
    if (last && !last.description && description) {
      last.description = description;
    }
  }

  return items;
}

function extractMenuLinks(html, baseUrl) {
  const links = [];
  const hrefRegex = /<a[^>]*href="([^"]+)"[^>]*>/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href) continue;
    if (!/menu|menus|dinner|lunch|brunch|food|pdf/i.test(href)) continue;
    try {
      const url = new URL(href, baseUrl).toString();
      links.push(url);
    } catch (err) {
      // ignore invalid urls
    }
  }
  return uniqueUrls(links);
}

async function searchDuckDuckGo(query) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchText(url);
  if (!html) return [];
  const results = [];
  const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    results.push(match[1]);
  }
  return uniqueUrls(results);
}

async function openaiSuggestUrls(restaurantName, location) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const prompt = `Find official menu URLs for the restaurant "${restaurantName}" in ${location}. Include platform URLs if the official site is unclear (SinglePlatform, Popmenu, ToastTab, Clover, ChowNow, Square, Menufy, BentoBox). Return a JSON array of URLs only.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: 'You are a web research assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      })
    });

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const urls = JSON.parse(match[0]);
    return Array.isArray(urls) ? uniqueUrls(urls) : [];
  } catch (err) {
    return [];
  }
}

async function findMenuUrls(restaurantName, location) {
  const urls = [];

  // OpenAI suggestions
  const openaiUrls = await openaiSuggestUrls(restaurantName, location);
  urls.push(...openaiUrls);

  // Platform patterns
  urls.push(...buildPlatformUrls(restaurantName, location));

  // Search results
  const queries = [
    `${restaurantName} menu ${location}`,
    `${restaurantName} official menu`,
    `${restaurantName} restaurant menu pdf`,
    `site:singleplatform.com ${restaurantName} menu`,
    `site:popmenu.com ${restaurantName} menu`,
    `site:toasttab.com ${restaurantName} menu`,
    `site:clover.com ${restaurantName} menu`,
    `site:chownow.com ${restaurantName} menu`,
    `site:menufy.com ${restaurantName} menu`,
    `site:bentobox.com ${restaurantName} menu`,
    `site:square.site ${restaurantName} menu`
  ];
  for (const q of queries) {
    const results = await searchDuckDuckGo(q);
    urls.push(...results);
  }

  return filterCandidateUrls(uniqueUrls(urls), restaurantName);
}

async function fetchMenuFromUrls(urls) {
  for (const url of urls) {
    const html = await fetchText(url);
    if (!html) continue;

    // try direct parse
    let items = extractMenuItemsFromHtml(html);
    if (items.length >= MIN_ITEMS) return { url, items };

    // try menu links from page
    const menuLinks = extractMenuLinks(html, url);
    for (const link of menuLinks) {
      const linkHtml = await fetchText(link);
      if (!linkHtml) continue;
      items = extractMenuItemsFromHtml(linkHtml);
      if (items.length >= MIN_ITEMS) return { url: link, items };
    }
  }
  return null;
}

async function main() {
  const needs = listRestaurantsNeedingMenus();
  if (needs.length === 0) {
    console.log('All restaurants have menus with enough items.');
    return;
  }

  const report = { location: LOCATION, updated: [] };

  for (const entry of needs) {
    const restaurantName = normalizeRestaurantName(entry.name);
    console.log(`\n=== ${restaurantName} ===`);
    console.log(`Current items: ${entry.count}`);

    const urls = await findMenuUrls(restaurantName, LOCATION);
    console.log(`URLs found: ${urls.length}`);

    const result = await fetchMenuFromUrls(urls);
    if (!result) {
      console.log('No menu found.');
      report.updated.push({ name: entry.name, success: false, urlsTried: urls.length });
      continue;
    }

    fs.writeFileSync(entry.menuFile, JSON.stringify(result.items, null, 2));
    console.log(`Saved ${result.items.length} items from ${result.url}`);
    report.updated.push({ name: entry.name, success: true, url: result.url, items: result.items.length });
  }

  fs.writeFileSync(OUTPUT_REPORT, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to ${OUTPUT_REPORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
