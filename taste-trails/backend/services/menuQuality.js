const TECH_GARBAGE_NAME_REGEX = /(bundle|worker|entrypoint|webpack|nextgen|nextgendash|videoplayer|wamedia|wasm|filehash|mainwebworker|chunk|sourcemap|source map|javascript|manifest|debug|v2|maw|wap|webp|jpeg|png|cache|api|json|xml|html|css|sdk)/i;
const NOISE_MENU_NAME_REGEX = /(^view\b.*\bmenu\b|^home$|^about$|^contact$|^menu$|^meta\b|privacy policy|terms of service|all rights reserved|\||©|^skip to|^navigate|^share|^print|^download|^save|^close|^back|^next|^previous|^search|^filter)/i;
const CONTACT_LOCATION_REGEX = /(uh-?oh|call|phone|tel|highway|ighway|hwy|street|st\.|avenue|ave|boulevard|blvd|road|rd|fort mill|charlotte|north carolina|south carolina|hours|open|closed|location|address|directions|map|find us|visit us)/i;
const MODIFIER_ONLY_REGEX = /^(with|add|extra|choice of|served with|free refills|no refills|fried or raw|hot or cold|to any|must be|please|note:|disclaimer|allergen|contains)\b/i;
const ORDER_ACTION_REGEX = /(order|pickup|carryout|takeout|delivery|call[\s-]?ahead|reserve|reservation|book|booking|gift card)/i;
const SOCIAL_MEDIA_REGEX = /(facebook|twitter|instagram|tiktok|youtube|linkedin|pinterest|snapchat|follow us|@|#hashtag|social)/i;
const WEBSITE_NAV_REGEX = /(login|signup|sign up|sign in|register|account|cart|checkout|payment|shipping|returns|faq)/i;
const NON_ALCOHOLIC_DRINK_REGEX = /(coffee|iced coffee|tea|iced tea|hot tea|milk|soft drink|soda|pop|coke|pepsi|sprite|root beer|ginger ale|lemonade|juice|water|bottled water|sweet tea|unsweet tea|hot chocolate)/i;
const REACTION_NAMES = new Set([
  'like',
  'love',
  'selfie',
  'dorothy',
  'toto',
  'haha',
  'yay',
  'wow',
  'confused',
  'support',
  'sorry',
  'anger',
  'flame',
  'plane',
  'share',
  'comment',
  'reply',
  'repost',
  'react',
  'emoji'
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, 0, 1);
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeDishName(value = '') {
  let name = normalizeText(value);
  if (!name) return '';
  name = name
    .replace(/\b\d{2,4}\s*-\s*\d{2,4}\s*cal\b/gi, ' ')
    .replace(/\b\d{2,4}\s*cal\b/gi, ' ')
    .replace(/\s+\d+(?:\.\d+)?\s*$/, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[+|/:;,.\-]+/, '')
    .replace(/[+|/:;,.\-]+$/, '')
    .trim();
  return name;
}

export function normalizePrice(value = '') {
  const text = normalizeText(value);
  if (!text) return '';
  const match = text.match(/(\d{1,3}(?:\.\d{2})?)/);
  if (!match) return '';
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 120) return '';
  return `$${match[1]}`;
}

export function isLikelyMenuName(name = '') {
  const clean = normalizeText(name);
  if (!clean || clean.length < 2 || clean.length > 100) return false;
  if (TECH_GARBAGE_NAME_REGEX.test(clean)) return false;
  if (NOISE_MENU_NAME_REGEX.test(clean)) return false;
  if (CONTACT_LOCATION_REGEX.test(clean)) return false;
  if (MODIFIER_ONLY_REGEX.test(clean)) return false;
  if (ORDER_ACTION_REGEX.test(clean) && !/\bmenu\b/i.test(clean)) return false;
  if (SOCIAL_MEDIA_REGEX.test(clean)) return false;
  if (WEBSITE_NAV_REGEX.test(clean)) return false;
  if (REACTION_NAMES.has(clean.toLowerCase())) return false;
  if (/\babove\b/i.test(clean)) return false;
  if (!/[a-z]/i.test(clean)) return false;
  if (/,\s*[A-Z]{2}$/.test(clean)) return false;
  if (/\b\d{5}(?:-\d{4})?\b/.test(clean)) return false;
  if (/^\d+(?:[./-]\d+)+$/.test(clean)) return false;
  if (/\d{3}[.\-\s]?\d{3}[.\-\s]?\d{2,4}/.test(clean)) return false;
  if (/^\d{2,4}\s*-\s*\d{2,4}\s*cal\b/i.test(clean)) return false;
  if (/^\d{2,4}\s*cal\b/i.test(clean)) return false;
  if (/^\d+\s*(oz|lb|lbs|g|kg)\b/i.test(clean)) return false;
  
  // Reject one-word items except oysters
  if (!clean.includes(' ') && !/^oysters?$/i.test(clean)) return false;
  
  // Reject items that are mostly numbers
  const alphaCount = (clean.match(/[a-z]/gi) || []).length;
  const digitCount = (clean.match(/\d/g) || []).length;
  if (digitCount > 0 && alphaCount <= 3) return false;
  
  // Reject camelCase tech strings (e.g., "mainWebWorker")
  if (!clean.includes(' ') && /[a-z][A-Z]/.test(clean) && clean.length > 14) return false;
  
  // Reject items that start with numbers followed by spaces
  if (/^\d+\s+/.test(clean) && !/^\d+\s+(oz|lb|piece|inch|ct|count|size|burger|sandwich|taco|pizza)/.test(clean.toLowerCase())) return false;
  
  return true;
}

export function normalizeMenuItem(raw, fallbackCategory = 'Menu') {
  if (!raw) return null;

  if (typeof raw === 'string') {
    const text = normalizeText(raw);
    if (!text) return null;
    if (NON_ALCOHOLIC_DRINK_REGEX.test(text)) return null;
    const priceMatch = text.match(/\$?\s?(\d{1,3}(?:\.\d{2})?)/);
    const name = normalizeDishName(priceMatch ? text.slice(0, priceMatch.index) : text);
    const price = priceMatch ? normalizePrice(priceMatch[1]) : '';
    if (!isLikelyMenuName(name)) return null;
    if (!price && /\b\d{2,4}\s*cal\b/i.test(name)) return null;
    return {
      name,
      description: '',
      price,
      category: fallbackCategory
    };
  }

  if (typeof raw !== 'object') return null;
  const name = normalizeDishName(raw.name || raw.title || raw.dish_name || '');
  const categoryText = normalizeText(raw.category || fallbackCategory);
  const descriptionText = normalizeText(raw.description || '');
  const beverageText = `${name} ${categoryText} ${descriptionText}`;
  if (NON_ALCOHOLIC_DRINK_REGEX.test(beverageText)) return null;
  if (!isLikelyMenuName(name)) return null;
  const description = descriptionText;
  const price = normalizePrice(raw.price || raw.amount || '');
  if (!price && /\b\d{2,4}\s*cal\b/i.test(name)) return null;
  if (!price && description.length > 180) return null;

  return {
    name,
    description,
    price,
    category: normalizeText(raw.category || fallbackCategory) || fallbackCategory
  };
}

export function sanitizeMenuItems(items = [], fallbackCategory = 'Menu') {
  const source = Array.isArray(items) ? items : [];
  const seenExact = new Set();
  const firstIndexByName = new Map();
  const out = [];

  for (const raw of source) {
    const normalized = normalizeMenuItem(raw, fallbackCategory);
    if (!normalized) continue;
    const nameKey = normalized.name.toLowerCase();
    const exactKey = `${nameKey}|${normalized.price.toLowerCase()}`;
    if (seenExact.has(exactKey)) continue;

    const existingIndex = firstIndexByName.get(nameKey);
    if (existingIndex !== undefined) {
      const existing = out[existingIndex];
      const existingHasPrice = !!existing.price;
      const incomingHasPrice = !!normalized.price;
      if (!existingHasPrice && incomingHasPrice) {
        out[existingIndex] = normalized;
        seenExact.add(exactKey);
        continue;
      }
      if (existingHasPrice && !incomingHasPrice) continue;
    } else {
      firstIndexByName.set(nameKey, out.length);
    }

    seenExact.add(exactKey);
    out.push(normalized);
  }

  return out;
}

export function flattenScrapedMenuItems(scraped = {}) {
  const sections = Array.isArray(scraped?.menu_sections) ? scraped.menu_sections : [];
  const flattened = [];

  for (const section of sections) {
    const sectionName = normalizeText(section?.section || section?.title || 'Menu') || 'Menu';
    const items = Array.isArray(section?.items) ? section.items : [];
    for (const raw of items) {
      const normalized = normalizeMenuItem(raw, sectionName);
      if (!normalized) continue;
      flattened.push(normalized);
    }
  }

  return sanitizeMenuItems(flattened);
}

export function buildMenuCompletenessReport({
  items = [],
  scrapeConfidence = null,
  urlConfidence = null
} = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const itemCount = safeItems.length;
  const pricedCount = safeItems.filter((item) => !!normalizePrice(item?.price)).length;
  const describedCount = safeItems.filter((item) => normalizeText(item?.description).length >= 10).length;
  const categoryCount = new Set(safeItems.map((item) => normalizeText(item?.category || 'Menu')).filter(Boolean)).size;
  const multiWordNameCount = safeItems.filter((item) => normalizeText(item?.name).includes(' ')).length;
  const suspiciousNameCount = safeItems.filter((item) => !isLikelyMenuName(item?.name)).length;
  const modifierLikeCount = safeItems.filter((item) => MODIFIER_ONLY_REGEX.test(normalizeText(item?.name))).length;
  const shortNameCount = safeItems.filter((item) => normalizeText(item?.name).length < 4).length;

  const itemCountScore =
    itemCount >= 80 ? 0.34 :
    itemCount >= 50 ? 0.3 :
    itemCount >= 30 ? 0.26 :
    itemCount >= 20 ? 0.2 :
    itemCount >= 12 ? 0.14 :
    itemCount >= 8 ? 0.1 : 0.03;

  const priceCoverageScore = 0.12 * clamp01(itemCount ? pricedCount / itemCount : 0);
  const descriptionCoverageScore = 0.08 * clamp01(itemCount ? describedCount / itemCount : 0);
  const categoryScore = 0.12 * clamp01(categoryCount / 6);
  const namingScore = 0.1 * clamp01(itemCount ? multiWordNameCount / itemCount : 0);
  const scrapeScore = 0.14 * clamp01(scrapeConfidence);
  const urlScore = 0.1 * clamp01(urlConfidence);

  let penalties = 0;
  const suspiciousRatio = itemCount ? suspiciousNameCount / itemCount : 0;
  const modifierRatio = itemCount ? modifierLikeCount / itemCount : 0;
  const shortNameRatio = itemCount ? shortNameCount / itemCount : 0;

  penalties += 0.3 * clamp01(suspiciousRatio);
  penalties += 0.18 * clamp01(modifierRatio);
  penalties += 0.1 * clamp01(shortNameRatio);

  if (itemCount >= 12 && categoryCount <= 1 && pricedCount === 0 && describedCount < 2) penalties += 0.12;
  if (itemCount < 8) penalties += 0.16;
  if (itemCount > 0 && pricedCount === 0 && describedCount === 0) penalties += 0.09;

  const score = clamp01(
    itemCountScore +
    priceCoverageScore +
    descriptionCoverageScore +
    categoryScore +
    namingScore +
    scrapeScore +
    urlScore -
    penalties
  );

  const tier =
    score >= 0.85 ? 'high' :
    score >= 0.65 ? 'medium' :
    score >= 0.45 ? 'low' : 'very_low';

  return {
    version: 'menu_completeness_v1',
    score: round2(score),
    tier,
    factors: {
      item_count_score: round2(itemCountScore),
      price_coverage_score: round2(priceCoverageScore),
      description_coverage_score: round2(descriptionCoverageScore),
      category_score: round2(categoryScore),
      naming_score: round2(namingScore),
      scrape_score: round2(scrapeScore),
      url_score: round2(urlScore),
      penalties: round2(penalties)
    },
    metrics: {
      item_count: itemCount,
      priced_item_count: pricedCount,
      described_item_count: describedCount,
      category_count: categoryCount,
      multiword_name_count: multiWordNameCount,
      suspicious_name_count: suspiciousNameCount,
      modifier_like_name_count: modifierLikeCount,
      short_name_count: shortNameCount
    }
  };
}

export function passesMenuCompleteness(report, minScore = 0.65, minItems = 12) {
  const score = Number(report?.score || 0);
  const itemCount = Number(report?.metrics?.item_count || 0);
  return Number.isFinite(score) && score >= Number(minScore) && itemCount >= Number(minItems);
}
