import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// findMenuUrlFromName.js
// Usage: node backend/scripts/findMenuUrlFromName.js "Harper's" "Greensboro" "NC" [--debug]
const MAX_RUNTIME = 20000; // 20 seconds
const startTime = Date.now();

import { findDomain } from '../../services/domainFinder.js';
import { guessMenuUrl } from '../services/menuUrlGuesser.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

function normalizeInput(str) {
  if (!str) return '';
  return str.trim().replace(/\s+/g, ' ');
}


export async function findMenuUrlFromName({ name, city, state, debug = false }) {
  let final = null;
  try {
    name = normalizeInput(name);
    city = normalizeInput(city);
    state = normalizeInput(state);

    if (!name) {
      throw new Error('Name is required');
    }

    // Guardrails: fallback if city/state missing
    let domainResult = null;
    try {
      if (city && state) {
        domainResult = await findDomain({ name, city, state });
      } else if (city) {
        domainResult = await findDomain({ name, city, state: '' });
      } else if (state) {
        domainResult = await findDomain({ name, city: '', state });
      } else {
        domainResult = await findDomain({ name, city: '', state: '' });
      }
    } catch (domainErr) {
      domainResult = { found: false, error: domainErr.message };
    }
    if (debug || !domainResult.found) {
      console.log('[DomainFinder]', JSON.stringify(domainResult, null, 2));
    }

    // --- DISABLED STRICT GATING FOR DEBUG ---
    // Log resolved domain
    if (debug) {
      console.log('[DEBUG] Resolved domain:', domainResult.domain);
    }
    // Log homepage URL being fetched
    let baseUrl = domainResult.domain ? `https://${domainResult.domain}` : null;
    if (debug && baseUrl) {
      console.log('[DEBUG] Homepage URL to fetch:', baseUrl);
    }

    // --- Pre-menu-routing: Location page detection ---
    let locationPageDetected = false;
    let selectedLocationUrl = null;
    let homepageHtml = null;
    if (baseUrl) {
      try {
        const res = await axios.get(baseUrl, { timeout: 10000, responseType: 'text', validateStatus: s => s < 500 });
        homepageHtml = res.data;
        const $ = cheerio.load(homepageHtml);
        const anchors = [];
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          const text = $(el).text();
          anchors.push({ href, text });
        });
        // Score anchors for city/state/location
        const city = (domainResult.city || '').toLowerCase();
        const state = (domainResult.state || '').toLowerCase();
        const patterns = [
          city,
          state,
          `/locations`,
          `/${city}`,
          `/${city.replace(/\s+/g, '-')}`,
        ];
        let bestScore = 0;
        let bestUrl = null;
        for (const a of anchors) {
          let score = 0;
          const href = (a.href || '').toLowerCase();
          const text = (a.text || '').toLowerCase();
          if (!href.startsWith('http') && !href.startsWith('/')) continue;
          if (city && (href.includes(city) || text.includes(city))) score += 5;
          if (state && (href.includes(state) || text.includes(state))) score += 2;
          if (/locations?/.test(href) || /locations?/.test(text)) score += 2;
          if (href.includes('/' + city)) score += 5;
          if (href.includes('/' + city.replace(/\s+/g, '-'))) score += 5;
          if (href.match(/\/(charlotte|raleigh|greensboro|durham|asheville)/)) score += 3;
          if (text.match(/charlotte|raleigh|greensboro|durham|asheville/)) score += 3;
          if (score > bestScore) {
            bestScore = score;
            bestUrl = href;
          }
        }
        // Only select if strong match
        if (bestScore >= 5 && bestUrl) {
          // Normalize URL
          if (bestUrl.startsWith('/')) {
            selectedLocationUrl = `https://${domainResult.domain}${bestUrl}`;
          } else if (bestUrl.startsWith('http')) {
            selectedLocationUrl = bestUrl;
          }
          locationPageDetected = true;
        }
        // Only treat homepage as final if it contains price matches or strong menu signals
        let homepageHasMenuSignals = false;
        if (!locationPageDetected && homepageHtml) {
          const priceMatches = (homepageHtml.match(/\$\s?\d{1,3}(?:\.\d{2})?/g) || []).length;
          const menuWords = ['menu', 'dinner', 'lunch', 'brunch', 'food'];
          const menuSignals = menuWords.filter(w => homepageHtml.toLowerCase().includes(w)).length;
          if (priceMatches > 2 || menuSignals > 2) {
            homepageHasMenuSignals = true;
          }
        }
        if (debug) {
          console.log(`[PreMenuRouting] Location page detected: ${locationPageDetected}`);
          console.log(`[PreMenuRouting] Selected location URL: ${selectedLocationUrl}`);
        }
        // If location page detected, update baseUrl
        if (locationPageDetected && selectedLocationUrl) {
          baseUrl = selectedLocationUrl;
        } else if (!homepageHasMenuSignals) {
          // If homepage lacks menu signals, do not treat as final
          if (debug) {
            console.log('[PreMenuRouting] Homepage lacks menu signals, not treating as final.');
          }
        }
      } catch (e) {
        if (debug) console.log(`[PreMenuRouting] ERROR: ${e.message}`);
      }
    }
    if (!domainResult.found || !domainResult.domain) {
      const result = { found: false, step: 'domain', reason: domainResult.reason || 'not_found', domainResult };
      if (debug) console.log(JSON.stringify(result, null, 2));
      final = result;
      return final;
    }
    // Call menuUrlGuesser on the selected baseUrl (location page or homepage)
    let menuResult = null;
    try {
      // If baseUrl is not the homepage, extract domain from URL
      let menuDomain = domainResult.domain;
      let menuBaseUrl = baseUrl;
      if (baseUrl && baseUrl !== `https://${domainResult.domain}`) {
        // Use the location page as the new base for menu discovery
        const urlObj = new URL(baseUrl);
        menuDomain = urlObj.hostname;
        // Pass the full location page URL to menuUrlGuesser if supported, else fallback to domain
        menuResult = await guessMenuUrl(menuDomain, { useHeadless: true, debug, baseUrl });
      } else {
        menuResult = await guessMenuUrl(menuDomain, { useHeadless: true, debug });
      }
    } catch (e) {
      menuResult = { found: false, url: null, confidence: 0, method: 'error', error: e.message };
    }
    if (debug || !menuResult.found) {
      if (debug) console.log('[MenuGuesser]', JSON.stringify(menuResult, null, 2));
    }
    // Hard block for third-party aggregators
    if (
      menuResult.url && (
        menuResult.url.includes("facebook.com") ||
        menuResult.url.includes("menufy") ||
        menuResult.url.includes("ubereats") ||
        menuResult.url.includes("doordash") ||
        menuResult.url.includes("grubhub")
      )
    ) {
      return { found: false, reason: "third-party-aggregator", url: menuResult.url };
    }
    final = {
      found: menuResult.found,
      domain: domainResult.domain,
      url: menuResult.url,
      confidence: menuResult.confidence,
      method: menuResult.method,
      menuResult,
      domainResult
    };
    return final;
  } catch (err) {
    final = { found: false, error: err.message, stack: err.stack };
    if (debug) console.error(JSON.stringify(final, null, 2));
    return final;
  }
}


if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    // Hardcoded test for Alexander Michael's
    const name = "Alexander Michael's";
    const city = "Charlotte";
    const state = "NC";
    const debug = true;
    const result = await findMenuUrlFromName({ name, city, state, debug });
    console.log(JSON.stringify(result, null, 2));
    // If menu URL found, call menu scraper and log item count
    if (result.menuResult?.found && result.menuResult?.url) {
      console.log("Calling menu scraper with:", result.menuResult.url);
      const { extractFullMenu } = await import('../../services/menuExtractor.js');
      const menuData = await extractFullMenu(result.menuResult.url);
      const itemCount = (menuData.categories || []).reduce((acc, c) => acc + ((c.items && c.items.length) || 0), 0);
      console.log("Extracted item count:", itemCount);
    }
    // Always write output file, even on early return or error
    const outputPath = path.resolve(__dirname, 'menu_url_output.json');
    try {
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log('Wrote output to:', outputPath);
    } catch (fileErr) {
      console.error('Failed to write menu_url_output.json:', fileErr.message);
    }
  })();
}
