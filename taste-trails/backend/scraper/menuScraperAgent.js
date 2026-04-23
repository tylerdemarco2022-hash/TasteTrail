import { chromium } from "playwright";

import pdfParse from "pdf-parse/lib/pdf-parse.js";

const PRICE_REGEX = /\$?\s?(\d{1,3}(?:\.\d{2})?)/;
const MENU_HINT_REGEX = /(menu|food|dinner|lunch|brunch|drinks?|cocktail|wine|beer|dessert|eat)/i;
const ORDER_ONLY_HINT_REGEX = /(order|pickup|carryout|takeout|delivery|call[\s-]?ahead|toasttab|clover|doordash|ubereats|grubhub)/i;
const BAD_TEXT_REGEX = /(privacy|terms|cookie|careers|facebook|instagram|twitter|youtube|accessibility|copyright|all rights reserved)/i;
const TECH_GARBAGE_REGEX = /(bundle|worker|entrypoint|webpack|nextgen|nextgendash|videoplayer|wamedia|wasm|filehash|mainwebworker|chunk|sourcemap|source map|javascript|manifest)/i;
const MENUISH_CONTEXT_REGEX = /(menu|menus|food|dish|dishes|meal|meals|entree|entrée|appetizer|appetiser|appetizers|appetisers|salad|sandwich|burger|pizza|pasta|taco|sushi|drink|drinks|cocktail|wine|beer|dessert|item|items|product|products|catalog|section|category)/i;
const NOISE_NAME_REGEX = /(^view\b.*\bmenu\b|^home$|^about$|^contact$|^menu$|^meta\b|privacy policy|terms of service|all rights reserved|\||©)/i;
const CONTACT_LOCATION_REGEX = /(uh-?oh|call|phone|tel|highway|ighway|hwy|street|st\.|avenue|ave|boulevard|blvd|road|rd|fort mill|charlotte|north carolina|south carolina|carolinas?\s+since\s+\d{2,4})/i;
const MODIFIER_ONLY_REGEX = /^(with|add|extra|choice of|served with|free refills|no refills|fried or raw|hot or cold|to any)\b/i;
const REACTION_WORDS = new Set([
  "like",
  "love",
  "selfie",
  "dorothy",
  "toto",
  "haha",
  "yay",
  "wow",
  "confused",
  "support",
  "sorry",
  "anger",
  "flame",
  "plane"
]);
const MENU_SECTION_HEADING_REGEX = /^(appetizers?|starters?|small plates?|pizzas?|soups?(?:\s*&\s*salads?)?|salads?|pastas?|sandwiches?|entrees?|desserts?|beverages?|drinks?|kids?|sides?)$/i;
const PDF_PRICE_AT_END_REGEX = /(\d{1,2}(?:\.\d{2})?(?:\/\d{1,2}(?:\.\d{2})?)?)\s*$/;

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function isLikelyPdfUrl(url = "") {
  return /\.pdf(?:$|\?)/i.test(String(url || ""));
}

function normalizeUrlCandidate(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).toString();
  } catch (_) {
    return "";
  }
}

function buildPdfFallbackSeeds(pdfUrl = "") {
  try {
    const parsed = new URL(pdfUrl);
    const origin = parsed.origin;
    const candidates = [
      `${origin}/menu`,
      `${origin}/menu/`,
      `${origin}/`,
      origin
    ];
    const unique = [];
    const seen = new Set();
    for (const candidate of candidates) {
      const normalized = normalizeUrlCandidate(candidate);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      unique.push(normalized);
    }
    return unique;
  } catch (_) {
    return [];
  }
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizePrice(value) {
  if (value == null) return "";
  const text = normalizeText(value);
  if (!text) return "";
  const match = text.match(/(\d{1,3}(?:\.\d{2})?)/);
  if (!match) return "";
  return `$${match[1]}`;
}

function normalizeSlashPrice(value = "") {
  const text = normalizeText(value);
  if (!text) return "";
  const slashMatch = text.match(/(\d{1,3}(?:\.\d{2})?)\s*\/\s*(\d{1,3}(?:\.\d{2})?)/);
  if (slashMatch) {
    return `$${slashMatch[1]}/$${slashMatch[2]}`;
  }
  return normalizePrice(text);
}

function isLikelyTechnicalIdentifier(name) {
  const value = normalizeText(name);
  if (!value) return false;
  if (TECH_GARBAGE_REGEX.test(value)) return true;
  if (NOISE_NAME_REGEX.test(value)) return true;
  if (REACTION_WORDS.has(value.toLowerCase())) return true;
  if (!value.includes(" ") && /[a-z][A-Z]/.test(value) && value.length > 14) return true;
  if (!value.includes(" ") && /[0-9]/.test(value) && value.length > 12) return true;
  return false;
}

function isValidDishCandidate({ name, description, price, context = "" }) {
  const cleanName = normalizeText(name);
  const cleanDescription = normalizeText(description);
  const cleanPrice = normalizePrice(price);
  const cleanContext = normalizeText(context).toLowerCase();
  if (!cleanName || cleanName.length < 3 || cleanName.length > 100) return false;
  if (BAD_TEXT_REGEX.test(cleanName)) return false;
  if (NOISE_NAME_REGEX.test(cleanName)) return false;
  if (isLikelyTechnicalIdentifier(cleanName)) return false;
  if (CONTACT_LOCATION_REGEX.test(cleanName)) return false;
  if (MODIFIER_ONLY_REGEX.test(cleanName)) return false;
  if (/\bsince\s*\d{2,4}\b/i.test(cleanName)) return false;
  if (!/[a-z]/i.test(cleanName)) return false;
  if (/^\d+(?:[./-]\d+)+$/.test(cleanName)) return false;
  if (/\d{3}[.\-\s]?\d{3}[.\-\s]?\d{2,4}/.test(cleanName)) return false;

  const hasMenuishContext = MENUISH_CONTEXT_REGEX.test(cleanContext);
  const hasDescription = cleanDescription.length >= 8;
  const hasPrice = Boolean(cleanPrice);
  const hasHumanSpacing = cleanName.includes(" ");

  if (!hasPrice && !hasDescription && !hasMenuishContext) return false;
  if (!hasPrice && !hasDescription && !hasHumanSpacing) return false;
  if (!hasPrice && cleanName.length < 4 && !hasDescription) return false;

  return true;
}

function extractJsonFromHtml(html = "") {
  const payloads = [];
  const ldJsonRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match = null;
  const domain = (() => {
    try {
      const urlMatch = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)/);
      if (urlMatch) return new URL(urlMatch[1]).hostname;
    } catch (_) {}
    return 'unknown';
  })();
  while ((match = ldJsonRegex.exec(html)) !== null) {
    let scriptText = (match[1] || "").trim();
    if (!scriptText) continue;
    // Remove control chars
    scriptText = scriptText.replace(/[\u0000-\u001F\u007F]/g, "");
    // Handle multiple JSON objects in one script tag
    const jsonObjects = [];
    let buffer = "";
    let depth = 0;
    for (let i = 0; i < scriptText.length; i++) {
      const char = scriptText[i];
      if (char === '{') {
        if (depth === 0) buffer = "";
        depth++;
      }
      if (depth > 0) buffer += char;
      if (char === '}') {
        depth--;
        if (depth === 0 && buffer) {
          jsonObjects.push(buffer);
          buffer = "";
        }
      }
    }
    for (const objText of jsonObjects.length ? jsonObjects : [scriptText]) {
      try {
        const parsed = require('../utils/safeJsonParse.js').safeJsonParse(`ld+json:${domain}`, objText);
        payloads.push(parsed);
      } catch (err) {
        console.warn(`[ld+json SKIPPED] ${domain} | ${objText.slice(0, 120)}...`);
        // Skip this block, do not crash
      }
    }
  }
  return payloads;
}

function flattenJsonMenuItems(value, out = [], context = "") {
  if (value == null) return out;

  if (Array.isArray(value)) {
    for (const entry of value) flattenJsonMenuItems(entry, out, context);
    return out;
  }

  if (typeof value !== "object") return out;
  const objectContext = `${context} ${Object.keys(value).join(" ")}`;

  const name =
    value.name ||
    value.title ||
    value.itemName ||
    value.dishName ||
    value.productName ||
    value.label ||
    "";
  const description =
    value.description ||
    value.desc ||
    value.summary ||
    value.subtitle ||
    "";

  let price =
    value.price ||
    value.amount ||
    value.cost ||
    value.displayPrice ||
    value.basePrice ||
    value.salePrice ||
    "";
  if (!price && typeof value.offers === "object") {
    price =
      value.offers?.price ||
      value.offers?.lowPrice ||
      value.offers?.highPrice ||
      "";
  }

  const normalizedName = normalizeText(name);
  const normalizedDescription = normalizeText(description);
  const normalizedPrice = normalizePrice(price);

  // Extract image URL from common JSON fields
  const rawImage =
    value.image || value.imageUrl || value.image_url ||
    value.photo || value.photoUrl || value.photo_url ||
    value.thumbnail || value.thumbnailUrl || value.thumbnail_url ||
    value.media || value.mediaUrl || "";
  const normalizedImage =
    typeof rawImage === "string" && /^https?:\/\//i.test(rawImage.trim())
      ? rawImage.trim()
      : "";

  if (isValidDishCandidate({
    name: normalizedName,
    description: normalizedDescription,
    price: normalizedPrice,
    context: objectContext
  })) {
    out.push({
      name: normalizedName,
      description: normalizedDescription,
      price: normalizedPrice,
      category: "Menu",
      ...(normalizedImage ? { image: normalizedImage } : {}),
      _context: objectContext
    });
  }

  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "object" && child !== null) {
      flattenJsonMenuItems(child, out, `${objectContext} ${key}`);
    }
  }

  return out;
}

function dedupeItems(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const name = normalizeText(item?.name);
    const price = normalizePrice(item?.price);
    const description = normalizeText(item?.description);
    const context = normalizeText(item?._context || item?.context || "");
    if (!isValidDishCandidate({ name, description, price, context })) continue;
    const key = `${name.toLowerCase()}|${price.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      description,
      price,
      category: item?.category || "Menu"
    });
  }
  return out;
}

async function extractDomItems(page) {
  const result = await page.evaluate(() => {
    const priceRegex = /\$?\s?\d{1,3}(?:\.\d{2})?/;
    const badTextRegex = /(privacy|terms|cookie|careers|facebook|instagram|twitter|youtube|accessibility|copyright)/i;
    const techGarbageRegex = /(bundle|worker|entrypoint|webpack|nextgen|nextgendash|videoplayer|wamedia|wasm|filehash|mainwebworker|chunk|sourcemap|source map|javascript|manifest)/i;
    const reactionWords = new Set(["like","love","selfie","dorothy","toto","haha","yay","wow","confused","support","sorry","anger","flame","plane"]);

    const normalize = (v) => String(v || "").replace(/\s+/g, " ").trim();
    const toPrice = (v) => {
      const text = normalize(v);
      if (!text) return "";
      const m = text.match(/(\d{1,3}(?:\.\d{2})?)/);
      return m ? `$${m[1]}` : "";
    };

    // Returns true if an image src looks like a real dish photo (not a logo/icon/SVG)
    const isValidImg = (src = "", w = 0) =>
      Boolean(src) &&
      !src.startsWith("data:") &&
      !/\.svg($|\?)/i.test(src) &&
      !/logo|icon|sprite|favicon|badge/i.test(src) &&
      w > 150;

    // Resolve the best src from an <img> element (handles lazy-load attributes)
    const imgSrc = (el) => {
      if (!el) return "";
      return (
        el.src ||
        el.getAttribute("data-src") ||
        el.getAttribute("data-lazy") ||
        el.getAttribute("data-original") ||
        ""
      );
    };

    const push = (list, name, price, description = "", category = "Menu", image = null) => {
      const cleanName = normalize(name);
      if (!cleanName || cleanName.length < 2 || cleanName.length > 100) return;
      if (badTextRegex.test(cleanName)) return;
      if (techGarbageRegex.test(cleanName)) return;
      if (reactionWords.has(cleanName.toLowerCase())) return;
      const item = { name: cleanName, price: toPrice(price), description: normalize(description), category };
      if (image) item.image = image;
      list.push(item);
    };

    const out = [];
    const selectors = [
      "[data-menu-item]",
      ".menu-item",
      "[class*='menu-item']",
      "[class*='menu_item']",
      "[class*='dish']",
      "[class*='product']",
      "[class*='entry']",
      "article",
      "li"
    ];
    // Limit DOM nodes to first 1500 - reduces DOM traversal time significantly
    const nodes = Array.from(document.querySelectorAll(selectors.join(","))).slice(0, 1500);
    const nodesExamined = nodes.length;

    for (const node of nodes) {
      const text = normalize(node.innerText || node.textContent || "");
      if (!text || text.length > 260 || !priceRegex.test(text) || badTextRegex.test(text)) continue;

      const nameNode =
        node.querySelector("[class*='name']") ||
        node.querySelector("h1,h2,h3,h4,h5,strong,b");
      const priceNode = node.querySelector("[class*='price'],[data-price]");

      let name = nameNode ? normalize(nameNode.textContent || "") : "";
      const priceMatch = text.match(priceRegex);
      const price = priceNode ? (priceNode.textContent || "") : (priceMatch ? priceMatch[0] : "");

      if (!name) {
        const beforePrice = priceMatch ? text.slice(0, priceMatch.index) : text;
        name = normalize(beforePrice.replace(/[-–—:|.]+$/, ""));
      }
      const description = normalize(
        text
          .replace(name, "")
          .replace(price, "")
          .replace(/\s{2,}/g, " ")
      );

      // Find the nearest <img> to this menu item node:
      // 1) inside the node itself, 2) inside the parent, 3) inside prev/next sibling
      let nearestImg = null;
      const imgCandidates = [
        node.querySelector("img"),
        node.parentElement && node.parentElement.querySelector("img"),
        node.previousElementSibling && node.previousElementSibling.querySelector("img"),
        node.nextElementSibling && node.nextElementSibling.querySelector("img"),
      ];
      for (const candidate of imgCandidates) {
        if (!candidate) continue;
        const src = imgSrc(candidate);
        const w = candidate.naturalWidth || candidate.width || 0;
        if (isValidImg(src, w)) { nearestImg = src; break; }
      }

      push(out, name, price, description, "Menu", nearestImg);
    }

    const lines = String(document.body?.innerText || "")
      .split("\n")
      .map((line) => normalize(line))
      .filter(Boolean);
    for (const line of lines) {
      if (!priceRegex.test(line) || badTextRegex.test(line)) continue;
      const priceMatch = line.match(priceRegex);
      const price = priceMatch ? priceMatch[0] : "";
      const beforePrice = priceMatch ? line.slice(0, priceMatch.index) : line;
      const name = normalize(beforePrice.replace(/[-–—:|.]+$/, ""));
      push(out, name, price, "", "Menu");
    }

    return {
      items: out.slice(0, 1200),
      nodesExamined
    };
  });
  return result;
}

async function findMenuLinks(page, currentUrl) {
  const knownMenuDomains = [
    "toasttab.com",
    "clover.com",
    "square.site",
    "spotmenus.com",
    "singleplatform.com"
  ];
  const baseUrl = new URL(currentUrl);
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a")).map((a) => ({
      href: a.getAttribute("href") || "",
      text: (a.textContent || "").trim()
    }))
  );

  const scored = [];
  for (const link of links) {
    if (!link?.href) continue;
    let absolute = "";
    try {
      absolute = new URL(link.href, currentUrl).toString();
    } catch (_) {
      continue;
    }
    let score = 0;
    const urlLower = absolute.toLowerCase();
    const textLower = normalizeText(link.text).toLowerCase();
    const hasMenuHint = MENU_HINT_REGEX.test(urlLower) || MENU_HINT_REGEX.test(textLower);
    const hasOrderHint = ORDER_ONLY_HINT_REGEX.test(urlLower) || ORDER_ONLY_HINT_REGEX.test(textLower);
    if (MENU_HINT_REGEX.test(urlLower)) score += 5;
    if (MENU_HINT_REGEX.test(textLower)) score += 4;
    if (urlLower.includes(".pdf")) score += 8;
    if (hasOrderHint && !hasMenuHint) score -= 8;
    if (/(order-online|online-order|pickup|carryout|takeout|call-ahead)/i.test(urlLower)) score -= 6;
    if (knownMenuDomains.some((d) => urlLower.includes(d))) score += 5;
    if (urlLower.includes(baseUrl.hostname)) score += 2;
    if (urlLower.includes("careers") || urlLower.includes("privacy")) score -= 5;
    if (score > 0) scored.push({ url: absolute, score });
  }

  const unique = [];
  const seen = new Set();
  // Limit link examination to first 200 to avoid walking entire DOM
  const topScored = scored.sort((a, b) => b.score - a.score).slice(0, 200);
  for (const entry of topScored) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    unique.push(entry.url);
    if (unique.length >= 4) break;  // Reduced from 6 to 4
  }
  return unique;
}

function flattenSections(menuSections = []) {
  const flattened = [];
  for (const section of menuSections) {
    for (const item of Array.isArray(section?.items) ? section.items : []) {
      if (typeof item === "string") {
        const text = normalizeText(item);
        if (!text) continue;
        const match = text.match(PRICE_REGEX);
        const name = normalizeText(match ? text.slice(0, match.index) : text);
        flattened.push({
          name,
          price: match ? `$${match[1]}` : "",
          description: "",
          category: section?.section || "Menu"
        });
      } else if (item && typeof item === "object") {
        flattened.push({
          name: item.name || item.title || item.dish_name || "",
          price: item.price || item.amount || "",
          description: item.description || "",
          category: item.category || section?.section || "Menu"
        });
      }
    }
  }
  return dedupeItems(flattened);
}

function parsePdfMenuLines(rawText = "") {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean);

  const items = [];
  let currentSection = "Menu";


  for (const rawLine of lines) {
    const line = rawLine
      .replace(/[•·]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!line || line.length > 240) continue;

    // --- DEBUG: Log all candidate subheaders ---
    let isLikelySubheader = false;
    let subheaderReason = "";
    if (MENU_SECTION_HEADING_REGEX.test(line)) {
      isLikelySubheader = true;
      subheaderReason = "regex";
    } else if (/^[A-Z0-9 &]{3,30}$/.test(line) && !/\d{1,2}(?:\.\d{2})?/.test(line) && line.split(' ').length <= 5) {
      isLikelySubheader = true;
      subheaderReason = "all-caps short";
    } else if (/^[A-Za-z][A-Za-z \-]{2,40}$/.test(line) && !/\d/.test(line) && line.length <= 32 && line === line.toUpperCase()) {
      // Extra: all-uppercase, no numbers, short
      isLikelySubheader = true;
      subheaderReason = "extra-all-caps";
    } else if (/^[A-Za-z][A-Za-z \-]{2,40}$/.test(line) && !/\d/.test(line) && line.length <= 32 && /^[A-Z][a-z]+( [A-Z][a-z]+)*$/.test(line)) {
      // Extra: Title Case, no numbers, short
      isLikelySubheader = true;
      subheaderReason = "title-case";
    }
    if (isLikelySubheader) {
      if (typeof console !== 'undefined' && console.log) {
        console.log(`[PDF SUBHEADER DETECTED] '${line}' (${subheaderReason})`);
      }
      currentSection = line
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (m) => m.toUpperCase());
      items.push({
        name: null,
        description: null,
        price: null,
        category: currentSection,
        isSubheader: true
      });
      continue;
    }

    if (/^(dinner menu|lunch menu|fall \d{4}|spring \d{4}|winter \d{4}|summer \d{4}|chef\/owners?|executive chef|general manager|updated on:)/i.test(line)) {
      continue;
    }

    let name = "";
    let description = "";
    let priceToken = "";

    const ellipsisMatch = line.match(/^(.*?)\.{2,}\s*(.*?)\s+(\d{1,2}(?:\.\d{2})?(?:\/\d{1,2}(?:\.\d{2})?)?)$/);
    if (ellipsisMatch) {
      name = normalizeText(ellipsisMatch[1]);
      description = normalizeText(ellipsisMatch[2]);
      priceToken = normalizeText(ellipsisMatch[3]);
    } else {
      const endPriceMatch = line.match(PDF_PRICE_AT_END_REGEX);
      if (!endPriceMatch) continue;
      const priceIdx = endPriceMatch.index ?? -1;
      if (priceIdx <= 0) continue;
      const left = normalizeText(line.slice(0, priceIdx));
      if (!left) continue;
      const parts = left.split(/\s+[-–—:|]\s+/);
      name = normalizeText(parts[0] || "");
      description = normalizeText(parts.slice(1).join(" "));
      priceToken = normalizeText(endPriceMatch[1]);
    }

    const price = normalizeSlashPrice(priceToken);
    name = normalizeText(
      String(name || "")
        .replace(/^[*•\-]+\s*/, "")
        .replace(/\s*\.{2,}\s*/g, " ")
    );
    description = normalizeText(
      String(description || "")
        .replace(/\s*\.{2,}\s*/g, " ")
    );
    if (!isValidDishCandidate({ name, description, price, context: `${currentSection} pdf` })) continue;

    items.push({
      name,
      description,
      price,
      category: currentSection || "Menu"
    });
  }

  return dedupeItems(items);
}

async function extractPdfItemsFromUrl(url) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    }
  });
  if (!response.ok) return [];
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/pdf") && !isLikelyPdfUrl(url) && !isLikelyPdfUrl(response.url)) {
    return [];
  }
  const pdfBytes = Buffer.from(await response.arrayBuffer());
  const parsed = await pdfParse(pdfBytes);
  return parsePdfMenuLines(parsed?.text || "");
}

function buildMenuConfidenceReport({
  items = [],
  visitedUrls = [],
  rawJsonItems = 0,
  rawDomItems = 0,
  rawPdfItems = 0,
  discoveredMenuLinks = 0
}) {
  const safeItems = Array.isArray(items) ? items : [];
  const safeVisited = Array.isArray(visitedUrls) ? visitedUrls : [];
  const itemCount = safeItems.length;
  const pricedCount = safeItems.filter((item) => Boolean(normalizePrice(item?.price))).length;
  const describedCount = safeItems.filter((item) => normalizeText(item?.description).length >= 10).length;
  const multiWordNameCount = safeItems.filter((item) => normalizeText(item?.name).includes(" ")).length;
  const categoryCount = new Set(
    safeItems
      .map((item) => normalizeText(item?.category || "Menu"))
      .filter(Boolean)
  ).size;
  const menuishVisitedCount = safeVisited.filter((url) => MENU_HINT_REGEX.test(String(url || ""))).length;

  const itemCountScore =
    itemCount >= 35 ? 0.34 :
    itemCount >= 20 ? 0.28 :
    itemCount >= 12 ? 0.22 :
    itemCount >= 8 ? 0.16 :
    itemCount >= 4 ? 0.08 : 0.02;
  const priceCoverageScore = 0.22 * clamp01(itemCount ? pricedCount / itemCount : 0);
  const descriptionCoverageScore = 0.1 * clamp01(itemCount ? describedCount / itemCount : 0);
  const namingScore = 0.08 * clamp01(itemCount ? multiWordNameCount / itemCount : 0);
  const categoryScore = 0.08 * clamp01(categoryCount / 4);
  const sourceDiversityScore =
    [rawJsonItems > 0, rawDomItems > 0, rawPdfItems > 0].filter(Boolean).length >= 2 ? 0.12 :
    (rawJsonItems > 0 || rawDomItems > 0 || rawPdfItems > 0) ? 0.07 : 0;
  const navigationScore = 0.06 * clamp01(menuishVisitedCount / Math.max(1, safeVisited.length));
  const pdfSignalScore = rawPdfItems > 0 ? 0.12 : 0;
  const discoveryScore = 0.04 * clamp01(discoveredMenuLinks / 4);

  let penalties = 0;
  if (itemCount > 0 && pricedCount === 0) penalties += 0.1;
  if (itemCount > 0 && describedCount === 0 && pricedCount < Math.max(3, Math.floor(itemCount * 0.3))) {
    penalties += 0.08;
  }

  const score = clamp01(
    itemCountScore +
    priceCoverageScore +
    descriptionCoverageScore +
    namingScore +
    categoryScore +
    sourceDiversityScore +
    navigationScore +
    pdfSignalScore +
    discoveryScore -
    penalties
  );

  const tier =
    score >= 0.85 ? "high" :
    score >= 0.65 ? "medium" :
    score >= 0.45 ? "low" : "very_low";

  return {
    version: "menu_scraper_confidence_v1",
    score: round2(score),
    tier,
    factors: {
      item_count_score: round2(itemCountScore),
      price_coverage_score: round2(priceCoverageScore),
      description_coverage_score: round2(descriptionCoverageScore),
      naming_quality_score: round2(namingScore),
      category_diversity_score: round2(categoryScore),
      source_diversity_score: round2(sourceDiversityScore),
      navigation_score: round2(navigationScore),
      pdf_signal_score: round2(pdfSignalScore),
      discovery_score: round2(discoveryScore),
      penalties: round2(penalties)
    },
    metrics: {
      item_count: itemCount,
      priced_item_count: pricedCount,
      described_item_count: describedCount,
      multiword_name_count: multiWordNameCount,
      category_count: categoryCount,
      visited_url_count: safeVisited.length,
      menuish_visited_url_count: menuishVisitedCount,
      raw_json_item_count: rawJsonItems,
      raw_dom_item_count: rawDomItems,
      raw_pdf_item_count: rawPdfItems,
      discovered_menu_link_count: discoveredMenuLinks
    }
  };
}

// ── Step 2: Restaurant hero image extraction ─────────────────────────────────
// Runs inside the browser via page.evaluate().
// Priority 1: explicit hero/banner/cover containers (CSS class / tag heuristics)
// Priority 2: largest above-the-fold image that passes the size + logo filter
async function extractHeroImage(page) {
  return page.evaluate(() => {
    function isLogoLike(src = "", alt = "") {
      return /logo|icon|sprite|favicon|badge/i.test(src) || /logo|icon/i.test(alt);
    }
    function bestSrc(el) {
      if (!el) return "";
      return (
        el.src ||
        el.getAttribute("data-src") ||
        el.getAttribute("data-lazy") ||
        el.getAttribute("data-original") ||
        ""
      );
    }

    // Priority 1: semantic hero containers
    const heroSelectors = [
      "header img",
      ".hero img", "[class*='hero'] img", "[id*='hero'] img",
      ".banner img", "[class*='banner'] img", "[id*='banner'] img",
      ".cover img", "[class*='cover'] img",
      "[class*='restaurant-header'] img", "[class*='header-image'] img",
      "[class*='splash'] img", "[class*='featured-image'] img",
      "section:first-of-type img",
    ];
    for (const sel of heroSelectors) {
      for (const img of Array.from(document.querySelectorAll(sel))) {
        const src = bestSrc(img);
        if (!src || src.startsWith("data:") || /\.svg($|\?)/i.test(src)) continue;
        if (isLogoLike(src, img.alt)) continue;
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (w >= 300 && h >= 150) return src;
      }
    }

    // Priority 2: largest above-the-fold image
    const fold = window.innerHeight;
    let best = null;
    let bestArea = 0;
    for (const img of Array.from(document.querySelectorAll("img"))) {
      const src = bestSrc(img);
      if (!src || src.startsWith("data:") || /\.svg($|\?)/i.test(src)) continue;
      if (isLogoLike(src, img.alt)) continue;
      const rect = img.getBoundingClientRect();
      if (rect.top > fold) continue;
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w < 300 || h < 150) continue;
      const area = w * h;
      if (area > bestArea) { bestArea = area; best = src; }
    }
    return best || null;
  }).catch(() => null);
}

export async function scrapeMenu(startUrl) {
  let browser = null;
  const globalStartTime = performance.now();
  const startTime = Date.now();  // Define at start so catch/finally can use it
  let discoveryEndTime = null;
  const networkPayloads = [];
  const visited = [];
  const aggregatedSections = [];
  const toVisit = [];
  const seenUrls = new Set();
  let rawJsonItems = 0;
  let rawDomItems = 0;
  let rawPdfItems = 0;
  let discoveredMenuLinks = 0;
  let heroImageUrl = null;
  let domNodesExamined = 0;
  let earlyExitTriggered = false;
  let earlyExitReason = null;
  let lastPageHtml = null;  // Store last page HTML for debugging
  let lastResponseStatus = null;  // Store HTTP status code
  let lastResolvedUrl = null;  // Store final resolved URL

  try {
    console.log('[SCRAPER][DEBUG] Scraping menu URL:', startUrl);
    let extractorType = 'unknown';
    if (isLikelyPdfUrl(startUrl)) {
      extractorType = 'pdf';
      visited.push(startUrl);
      const pdfItems = await extractPdfItemsFromUrl(startUrl);
      console.log('[SCRAPER][DEBUG] Extractor type:', extractorType);
      console.log('[SCRAPER][DEBUG] PDF candidate count:', pdfItems.length);
      rawPdfItems += pdfItems.length;
      if (pdfItems.length > 0) {
        // ...existing code...
        aggregatedSections.push({
          section: "Menu (PDF)",
          items: pdfItems
        });
        const flattened = flattenSections(aggregatedSections);
        const confidenceReport = buildMenuConfidenceReport({
          items: flattened,
          visitedUrls: visited,
          rawJsonItems,
          rawDomItems,
          rawPdfItems,
          discoveredMenuLinks
        });
        const confidence = confidenceReport.score;
        const totalTime = performance.now() - globalStartTime;
        const sources = ['pdf'].filter(s => s === 'pdf' && rawPdfItems > 0);

        const response = {
          menu_sections: flattened.length
            ? [{ section: "Menu", items: flattened }]
            : [],
          visited_urls: visited,
          source_url: startUrl,
          item_count: flattened.length,
          confidence,
          confidence_report: confidenceReport,
          hero_image_url: null
        };

        if (process.env.NODE_ENV !== 'production') {
          response.debug_metrics = {
            discovery_time_ms: 0,
            scrape_time_ms: totalTime,
            total_time_ms: totalTime,
            total_items_found: flattened.length,
            sources_used: sources,
            early_exit_triggered: false,
            pages_visited: 1,
            json_payloads_captured: 0,
            dom_nodes_examined: 0
          };
        }

        return response;
      }
    } else {
      extractorType = 'html';
      toVisit.push(startUrl);
    }

    if (toVisit.length === 0) {
      const fallbackSeeds = buildPdfFallbackSeeds(startUrl);
      for (const seed of fallbackSeeds) {
        if (!seenUrls.has(seed)) toVisit.push(seed);
      }
    }

    console.log(`[SCRAPER:P1] Launching browser...`);
    
    browser = await chromium.launch({ headless: true, args: ['--single-process'] });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    });
    
    // Route to block heavy resources that slow down page load
    await context.route('**/*.{png,jpg,jpeg,gif,svg}', route => route.abort());
    await context.route('**/*.css', route => route.abort());
    await context.route('**/*.woff*', route => route.abort());
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(20000);  // Reduced from 45s to 20s - fail fast on slow sites

    page.on("response", async (response) => {
      try {
        // Skip collection if we already have enough payloads
        if (networkPayloads.length >= 25) return;
        const url = response.url().toLowerCase();
        const contentType = (response.headers()["content-type"] || "").toLowerCase();
        if (!contentType.includes("application/json")) return;
        if (!/(menu|item|product|dish|graphql|api|order|catalog|wp-json)/.test(url)) return;
        const data = await response.json().catch(() => null);
        if (!data) return;
        networkPayloads.push(data);
      } catch (_) {}
    });

    discoveryEndTime = performance.now();

    let foundEnoughItems = false;  // Early exit flag
    while (toVisit.length > 0 && seenUrls.size < 4 && !foundEnoughItems) {
      const target = toVisit.shift();
      if (!target || seenUrls.has(target)) continue;
      seenUrls.add(target);
      visited.push(target);

      try {
        const pageStartTime = Date.now();
        const navResponse = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 20000 });  // Reduced from 45s to 20s
        console.log('[SCRAPER][DEBUG] Extractor type:', extractorType);
        const navStatus = navResponse?.status?.() || null;
        const navContentType = String(navResponse?.headers?.()["content-type"] || "").toLowerCase();
        const navFinalUrl = navResponse?.url?.() || target;
        
        // Store for debugging
        if (navStatus) lastResponseStatus = navStatus;
        lastResolvedUrl = navFinalUrl;
        if (navContentType.includes("application/pdf") || isLikelyPdfUrl(navFinalUrl)) {
          const pdfItems = await extractPdfItemsFromUrl(navFinalUrl);
          rawPdfItems += pdfItems.length;
          if (pdfItems.length > 0) {
            aggregatedSections.push({
              section: "Menu (PDF)",
              items: pdfItems
            });
          } else {
            const fallbackSeeds = buildPdfFallbackSeeds(navFinalUrl);
            for (const seed of fallbackSeeds) {
              if (!seenUrls.has(seed) && !toVisit.includes(seed)) toVisit.push(seed);
            }
          }
          continue;
        }
        // Conditional wait: skip wait if we already have content from previous page
        if (aggregatedSections.length === 0) {
          // First page load: wait for JS execution and content
          await page.waitForTimeout(600);
        }
        
        // Capture hero image on first successfully loaded page (best chance of finding it)
        if (!heroImageUrl && aggregatedSections.length === 0) {
          heroImageUrl = await extractHeroImage(page);
        }
      } catch (err) {
        console.log(`[SCRAPER:NAVIGATION] Failed to load ${target.substring(0, 50)}... - ${err.message?.substring(0, 50) || 'timeout'}`);
        continue;
      }

        const html = await page.content();
        lastPageHtml = html;  // Store for debugging
        console.log('[SCRAPER][DEBUG] Raw HTML length:', html.length);
        if (html.length > 0) {
          const tempHtmlPath = require('os').tmpdir() + '/deans_steakhouse_menu.html';
          require('fs').writeFileSync(tempHtmlPath, html.slice(0, 2000), 'utf8');
          console.log('[SCRAPER][DEBUG] Saved first 2000 chars to:', tempHtmlPath);
        }
        let candidateReasons = [];
        const scriptPayloads = extractJsonFromHtml(html);
        const allPayloads = [...networkPayloads, ...scriptPayloads];
        const jsonItems = [];
        for (const payload of allPayloads) {
          const candidates = flattenJsonMenuItems(payload, []);
          console.log('[SCRAPER][DEBUG] JSON candidate count:', candidates.length);
          for (const item of candidates) {
            if (!item.name) candidateReasons.push('Missing name');
            if (!item.price) candidateReasons.push('Missing price');
            // ...existing code...
          }
          jsonItems.push(...dedupeItems(candidates));
        }
        rawJsonItems += jsonItems.length;
        if (jsonItems.length > 0) {
          aggregatedSections.push({
            section: "Menu (JSON)",
            items: jsonItems
          });
        }
        if (candidateReasons.length > 0) {
          console.log('[SCRAPER][DEBUG] Candidate rejection reasons:', candidateReasons);
        }

      // Track DOM nodes examined via instrumented extractDomItems
        const domItemsResult = await extractDomItems(page);
        const domItems = Array.isArray(domItemsResult) ? domItemsResult : domItemsResult.items;
        console.log('[SCRAPER][DEBUG] DOM candidate count:', domItems.length);
        let domCandidateReasons = [];
        for (const item of domItems) {
          if (!item.name) domCandidateReasons.push('Missing name');
          if (!item.price) domCandidateReasons.push('Missing price');
          // ...existing code...
        }
        if (domItemsResult.nodesExamined !== undefined) {
          domNodesExamined += domItemsResult.nodesExamined;
        }
        const finalDomItems = dedupeItems(domItems);
        rawDomItems += finalDomItems.length;
        if (finalDomItems.length > 0) {
          aggregatedSections.push({
            section: "Menu (DOM)",
            items: finalDomItems
          });
        }
        if (domCandidateReasons.length > 0) {
          console.log('[SCRAPER][DEBUG] DOM candidate rejection reasons:', domCandidateReasons);
        }

      // Early exit: if we've found 6+ items from 2+ sources, we can stop crawling
      const totalItems = rawJsonItems + rawDomItems + rawPdfItems;
      if (totalItems >= 6 && aggregatedSections.length >= 2) {
        earlyExitTriggered = true;
        earlyExitReason = `Found ${totalItems} items from ${aggregatedSections.length} sources at ${seenUrls.size} URLs`;
        console.log(`[SCRAPER:EARLY-EXIT] ${earlyExitReason}`);
        foundEnoughItems = true;
        break;
      }

      const nextLinks = await findMenuLinks(page, target);
      discoveredMenuLinks += nextLinks.length;
      for (const next of nextLinks) {
        if (isLikelyPdfUrl(next)) {
          try {
            const pdfItems = await extractPdfItemsFromUrl(next);
            rawPdfItems += pdfItems.length;
            if (pdfItems.length > 0) {
              aggregatedSections.push({
                section: "Menu (PDF)",
                items: pdfItems
              });
              visited.push(next);
            } else {
              const fallbackSeeds = buildPdfFallbackSeeds(next);
              for (const seed of fallbackSeeds) {
                if (!seenUrls.has(seed) && !toVisit.includes(seed)) toVisit.push(seed);
              }
            }
          } catch (_) {}
          continue;
        }
        if (!seenUrls.has(next)) toVisit.push(next);
      }
    }

    const flattened = flattenSections(aggregatedSections);
    const confidenceReport = buildMenuConfidenceReport({
      items: flattened,
      visitedUrls: visited,
      rawJsonItems,
      rawDomItems,
      rawPdfItems,
      discoveredMenuLinks
    });
    const confidence = confidenceReport.score;
    const totalTime = performance.now() - globalStartTime;
    const discoveryTime = discoveryEndTime - globalStartTime;
    const scrapeTime = totalTime - discoveryTime;
    
    const sourcesUsed = [
      rawJsonItems > 0 && 'json',
      rawDomItems > 0 && 'dom',
      rawPdfItems > 0 && 'pdf'
    ].filter(Boolean);

    const response = {
      menu_sections: flattened.length
        ? [{ section: "Menu", items: flattened }]
        : [],
      visited_urls: visited,
      source_url: startUrl,
      item_count: flattened.length,
      confidence,
      confidence_report: confidenceReport,
      hero_image_url: heroImageUrl || null
    };

    if (process.env.NODE_ENV !== 'production') {
      response.debug_metrics = {
        discovery_time_ms: Math.round(discoveryTime),
        scrape_time_ms: Math.round(scrapeTime),
        total_time_ms: Math.round(totalTime),
        total_items_found: flattened.length,
        sources_used: sourcesUsed,
        early_exit_triggered: earlyExitTriggered,
        early_exit_reason: earlyExitReason,
        pages_visited: visited.length,
        json_payloads_captured: networkPayloads.length,
        dom_nodes_examined: domNodesExamined,
        http_status: lastResponseStatus,
        final_url: lastResolvedUrl,
        html_size_bytes: lastPageHtml ? lastPageHtml.length : 0
      };
      
      // Include HTML snapshot if no items were found
      if (flattened.length === 0 && lastPageHtml) {
        response.debug_html_snapshot = lastPageHtml.substring(0, 50000);  // First 50KB
      }
    }

    return response;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`[SCRAPER:ERROR] Failed after ${elapsed}ms: ${error?.message?.substring(0, 50) || 'unknown'}`);
    const confidenceReport = {
      version: "menu_scraper_confidence_v1",
      score: 0,
      tier: "very_low",
      factors: {
        item_count_score: 0,
        price_coverage_score: 0,
        description_coverage_score: 0,
        naming_quality_score: 0,
        category_diversity_score: 0,
        source_diversity_score: 0,
        navigation_score: 0,
        pdf_signal_score: 0,
        discovery_score: 0,
        penalties: 0
      },
      metrics: {
        item_count: 0,
        priced_item_count: 0,
        described_item_count: 0,
        multiword_name_count: 0,
        category_count: 0,
        visited_url_count: visited.length,
        menuish_visited_url_count: visited.filter((url) => MENU_HINT_REGEX.test(String(url || ""))).length,
        raw_json_item_count: rawJsonItems,
        raw_dom_item_count: rawDomItems,
        raw_pdf_item_count: rawPdfItems,
        discovered_menu_link_count: discoveredMenuLinks
      },
      error: error?.message || String(error)
    };

    return {
      menu_sections: [],
      visited_urls: visited,
      source_url: startUrl,
      item_count: 0,
      confidence: 0,
      confidence_report: confidenceReport,
      error: error?.message || String(error)
    };
  } finally {
    const elapsed = Date.now() - startTime;
    console.log(`[SCRAPER:CLOSING] Closing browser after ${elapsed}ms total`);
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}

export default scrapeMenu;
