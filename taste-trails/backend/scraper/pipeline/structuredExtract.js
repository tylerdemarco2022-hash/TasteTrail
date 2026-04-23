/**
 * Structured Data Extraction
 *
 * Before DOM parsing, try extracting menu items from structured data:
 * 1. JSON-LD (ld+json) blocks — sanitize control chars; skip bad blocks
 * 2. Embedded app state: __NEXT_DATA__, __NUXT__, __APOLLO_STATE__, __INITIAL_STATE__
 * 3. API hints: inline JSON with /api/, graphql, menu.json patterns
 *
 * If any yields >= 10 items → normalize + return, skip DOM parsing.
 */

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizePrice(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const text = normalizeText(value);
  if (!text) return null;
  const match = text.match(/(\d{1,3}(?:\.\d{2})?)/);
  return match ? parseFloat(match[1]) : null;
}

function isValidItemName(name) {
  if (!name || name.length < 2 || name.length > 120) return false;
  if (!/[a-z]/i.test(name)) return false;
  if (/privacy|terms|cookie|careers|copyright|all rights reserved/i.test(name)) return false;
  return true;
}

const RECURSE_KEYS = [
  'hasMenuSection', 'hasMenuItem', 'items', 'menuItems',
  'products', 'dishes', 'entries', 'children', 'menu', 'sections', 'categories'
];

const DIRECT_ITEM_COLLECTION_KEYS = ['hasMenuItem', 'items', 'menuItems', 'products', 'dishes', 'entries', 'children'];
const SECTION_LABEL_KEYS = [
  'section_name', 'sectionName', 'section', 'category', 'categoryName',
  'menuSection', 'menuCategory', 'group', 'groupName', 'heading', 'header'
];
const SECTION_TYPE_REGEX = /(menu.?section|section|category|group)/i;
const SECTION_BAD_TEXT_REGEX = /privacy|terms|cookie|careers|copyright|all rights reserved/i;

function isLikelySectionLabel(value) {
  const text = normalizeText(value);
  if (!text) return false;
  if (text.length < 2 || text.length > 60) return false;
  if (!/[a-z]/i.test(text)) return false;
  if (SECTION_BAD_TEXT_REGEX.test(text)) return false;
  if (/\$\s?\d/.test(text)) return false;
  if (/\d{3}[.\-\s]?\d{3}[.\-\s]?\d{2,4}/.test(text)) return false;
  return true;
}

function resolveSectionName(obj, parentSection = 'Menu') {
  if (!obj || typeof obj !== 'object') return parentSection;

  for (const key of SECTION_LABEL_KEYS) {
    const candidate = obj[key];
    if (typeof candidate === 'string' && isLikelySectionLabel(candidate)) {
      return normalizeText(candidate);
    }
  }

  const nodeType = normalizeText(obj['@type'] || obj.type || '');
  const hasSectionType = SECTION_TYPE_REGEX.test(nodeType);
  const hasDirectItemCollections = DIRECT_ITEM_COLLECTION_KEYS.some((key) => {
    const value = obj[key];
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value && typeof value === 'object');
  });
  const fallbackLabel = normalizeText(obj.name || obj.title || '');
  if ((hasSectionType || hasDirectItemCollections) && isLikelySectionLabel(fallbackLabel)) {
    return fallbackLabel;
  }

  return parentSection;
}

function flattenMenuItems(obj, items = [], sectionName = 'Menu') {
  if (!obj || typeof obj !== 'object') return items;

  if (Array.isArray(obj)) {
    for (const entry of obj) flattenMenuItems(entry, items, sectionName);
    return items;
  }

  const currentSection = resolveSectionName(obj, sectionName);

  // Check if this looks like a menu item
  const name = normalizeText(obj.name || obj.title || obj.itemName || obj.dishName || obj.label || '');
  const description = normalizeText(obj.description || obj.desc || obj.summary || obj.subtitle || '');
  const rawPrice = obj.price || obj.amount || obj.cost || obj.displayPrice || obj.basePrice ||
    (obj.offers && (obj.offers.price || obj.offers.lowPrice)) || null;
  const price = normalizePrice(rawPrice);

  if (isValidItemName(name) && (price || description.length > 5)) {
    items.push({
      name,
      description,
      price,
      section_name: currentSection || 'Menu'
    });
  }

  // Recurse into nested objects
  for (const key of RECURSE_KEYS) {
    if (obj[key]) {
      flattenMenuItems(obj[key], items, currentSection || sectionName || 'Menu');
    }
  }

  return items;
}

function safeParseJson(raw, label = 'unknown') {
  try {
    const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, '');
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn(`[structuredExtract] JSON parse failed for ${label}: ${e.message.slice(0, 80)}`);
    return null;
  }
}

function extractJsonLd(html) {
  const items = [];
  const ldRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = ldRegex.exec(html)) !== null) {
    const raw = (match[1] || '').trim();
    if (!raw) continue;

    // Handle multiple JSON objects in one script tag
    const jsonObjects = [];
    let buffer = '';
    let depth = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      if (char === '{') { if (depth === 0) buffer = ''; depth++; }
      if (depth > 0) buffer += char;
      if (char === '}') { depth--; if (depth === 0 && buffer) { jsonObjects.push(buffer); buffer = ''; } }
    }

    for (const objText of jsonObjects.length ? jsonObjects : [raw]) {
      const parsed = safeParseJson(objText, 'ld+json');
      if (!parsed) continue;

      const type = String(parsed['@type'] || '').toLowerCase();
      if (type.includes('menu') || type.includes('restaurant') || type.includes('foodestablishment')) {
        flattenMenuItems(parsed, items);
      }

      if (Array.isArray(parsed['@graph'])) {
        for (const node of parsed['@graph']) {
          const nodeType = String(node?.['@type'] || '').toLowerCase();
          if (nodeType.includes('menu') || nodeType.includes('restaurant')) {
            flattenMenuItems(node, items);
          }
        }
      }
    }
  }

  return items;
}

function extractAppState(html) {
  const items = [];
  const statePatterns = [
    { regex: /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i, label: '__NEXT_DATA__' },
    { regex: /window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|$)/i, label: '__NEXT_DATA__' },
    { regex: /window\.__NUXT__\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|$)/i, label: '__NUXT__' },
    { regex: /window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|$)/i, label: '__APOLLO_STATE__' },
    { regex: /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|$)/i, label: '__INITIAL_STATE__' },
    { regex: /window\.__DATA__\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|$)/i, label: '__DATA__' },
  ];

  for (const { regex, label } of statePatterns) {
    const match = html.match(regex);
    if (!match) continue;

    const parsed = safeParseJson(match[1], label);
    if (!parsed) continue;

    flattenMenuItems(parsed, items);
    if (items.length >= 10) return items;
  }

  return items;
}

function extractApiHints(html) {
  const apiRegex = /["']((?:https?:)?\/\/[^"']*(?:\/api\/|graphql|menu\.json)[^"']*?)["']/gi;
  const hints = [];
  let match;

  while ((match = apiRegex.exec(html)) !== null) {
    hints.push(match[1]);
    if (hints.length >= 5) break;
  }

  return hints;
}

function dedupeItems(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.name.toLowerCase()}|${item.price || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Main entry point: extract structured data from HTML.
 * Returns normalized menu items array.
 */
export function extractStructuredData(html) {
  if (!html || typeof html !== 'string') return [];

  // 1. JSON-LD
  const ldItems = extractJsonLd(html);
  if (ldItems.length >= 10) return dedupeItems(ldItems);

  // 2. App state
  const stateItems = extractAppState(html);
  const combined = [...ldItems, ...stateItems];
  if (combined.length >= 10) return dedupeItems(combined);

  // 3. API hints — log them for debugging
  const apiHints = extractApiHints(html);
  if (apiHints.length > 0) {
    console.log(`[structuredExtract] Found ${apiHints.length} API hints:`, apiHints.slice(0, 3));
  }

  return dedupeItems(combined);
}
