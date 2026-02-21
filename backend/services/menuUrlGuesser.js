// menuUrlGuesser.js
// Deterministic Discovery Engine for menu URL guessing
// Clean rewrite: single Puppeteer session, URL scoring, structural signals

import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

const COMMON_PATHS = [
  '/menu', '/menus', '/dinner', '/dinner-menu', '/lunch', '/lunch-menu', '/brunch', '/brunch-menu', '/food', '/food-menu', '/our-menu', '/eat', '/dining', '/kitchen',
  '/menus/dinner', '/menus/lunch', '/menu/dinner', '/menu/lunch', '/menu.pdf', '/dinner-menu.pdf', '/lunch-menu.pdf', '/menus/menu.pdf', '/assets/menu.pdf', '/assets/dinner-menu.pdf', '/files/menu.pdf', '/uploads/menu.pdf', '/wp-content/uploads/menu.pdf', '/wp-content/uploads/dinner-menu.pdf', '/index.php/menu', '/index.php/dinner-menu', '/menu/', '/menus/', '/dinner/', '/lunch/', '/restaurant/menu', '/restaurant/dinner', '/restaurant/menus', '/dinner-fall'
];

const PRICE_REGEX = /(^|\s)\$?\d{1,3}(\.\d{1,2})?(?=\s|$)/g;
const HEADING_KEYWORDS = /appetizer|entree|salad|pizza|burger|cocktail/i;
const EXCLUDE_DOMAINS = /yelp|ubereats|grubhub|doordash/i;

function scoreUrl(domain, url) {
  let score = 0;
  const path = url.toLowerCase();
  if (path.includes('menu')) score += 50;
  if (path.includes('dinner')) score += 40;
  if (path.includes('lunch')) score += 30;
  if (path.endsWith('.pdf')) score += 60;
  if (EXCLUDE_DOMAINS.test(domain)) score -= 100;
  // Exact domain match
  try {
    const u = new URL(url);
    if (u.hostname.replace(/^www\./, '') === domain.replace(/^www\./, '')) score += 20;
  } catch {}
  return score;
}

export async function guessMenuUrl(domain) {
  // Build candidate URLs
  const candidates = COMMON_PATHS.map(path => normalizeUrl(domain, path));
  // Score candidates
  const scored = candidates.map(url => ({ url, score: scoreUrl(domain, url) }));
  scored.sort((a, b) => b.score - a.score);
  const selected = scored[0];

  // Puppeteer navigation and HTML extraction
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
  );
  const response = await page.goto(selected.url, { waitUntil: "domcontentloaded" });
  console.log("RESPONSE_STATUS:", response?.status());
  console.log("RESPONSE_HEADERS:", response?.headers());

  const htmlRaw = await page.content();
  console.log("RAW_HTML_LENGTH:", htmlRaw.length);
  if (htmlRaw.length === 0) {
    console.log("PAGE_TITLE:", await page.title());
  }

  await browser.close();
  return {};
}

if (import.meta.url === process.argv[1]) {
  const domain = 'culinarydropout.com';
  (async () => {
    await guessMenuUrl(domain);
  })();
}
