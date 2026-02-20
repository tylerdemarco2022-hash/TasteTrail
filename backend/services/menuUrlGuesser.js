// Reusable structured menu detection for a given URL
async function detectStructuredMenu(url) {
  const puppeteer = await import('puppeteer');
  // Remove hash fragments for testing
  const urlNoHash = url.split('#')[0];
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto(urlNoHash, { waitUntil: "networkidle2" });
  const content = await page.content();
  const urlPath = new URL(urlNoHash).pathname;
  // === HARD REQUIREMENTS ===
  // Rule 1: URL Context Rule
  const urlLower = urlPath.toLowerCase();
  const isHomepage = urlLower === '/' || urlLower === '';
  const hasMenuKeyword = /menu|menus|dinner|lunch|brunch/.test(urlLower);
  if (isHomepage || !hasMenuKeyword) {
    await browser.close();
    return { found: false, url: urlNoHash, confidence: 0, method: "structured-menu-path", reason: "URL does not qualify (homepage or missing menu keyword)" };
  }
  // Rule 2: Density Rule
  const priceMatches = (content.match(/\$\s?\d+(\.\d{2})?/g) || []).length;
  const menuItemCount = await page.$$eval('[class*="menu"], [class*="item"], [class*="dish"]', els => els.length);
  if (priceMatches < 10 || menuItemCount < 8) {
    await browser.close();
    return { found: false, url: urlNoHash, confidence: 0, method: "structured-menu-path", reason: `Density too low (priceMatches: ${priceMatches}, menuItemCount: ${menuItemCount})` };
  }
  // Rule 3: Menu Section Headings
  const headings = await page.$$eval('h1,h2,h3,h4,h5,h6', els => els.map(e => e.textContent.toLowerCase()));
  const hasMenuSection = headings.some(h => h.includes('appetizer') || h.includes('entree') || h.includes('salad') || h.includes('dessert') || h.includes('sides'));
  if (!hasMenuSection) {
    await browser.close();
    return { found: false, url: urlNoHash, confidence: 0, method: "structured-menu-path", reason: "No menu section heading found" };
  }
  // Rule 4: Link Isolation Rule (basic: reject if density is low and page has marketing/hero/slider)
  // For now, only apply if density is borderline (already rejected above if too low)
  // If you want to add more, you can expand here.
  await browser.close();
  return { found: true, url: urlNoHash, confidence: 95, method: "structured-menu-path" };
}
// menuUrlGuesser.js
// Utility to guess the most likely dinner menu URL for a restaurant domain
// Usage: const guessMenuUrl = require('./menuUrlGuesser');
// await guessMenuUrl('131main.com');

import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
let browser = null;

const COMMON_PATHS = [
  '/menu',
  '/menus',
  '/dinner',
  '/dinner-menu',
  '/lunch',
  '/lunch-menu',
  '/brunch',
  '/brunch-menu',
  '/food',
  '/food-menu',
  '/our-menu',
  '/eat',
  '/dining',
  '/kitchen',
  // Combined variations
  '/menus/dinner',
  '/menus/lunch',
  '/menu/dinner',
  '/menu/lunch',
  // PDF patterns
  '/menu.pdf',
  '/dinner-menu.pdf',
  '/lunch-menu.pdf',
  '/menus/menu.pdf',
  '/assets/menu.pdf',
  '/assets/dinner-menu.pdf',
  '/files/menu.pdf',
  '/uploads/menu.pdf',
  '/wp-content/uploads/menu.pdf',
  '/wp-content/uploads/dinner-menu.pdf',
  // CMS-specific
  '/index.php/menu',
  '/index.php/dinner-menu',
  // Trailing slash versions
  '/menu/',
  '/menus/',
  '/dinner/',
  '/lunch/',
  // Hashed anchors (common in single-page sites)
  '/#menu',
  '/#dinner',
  '/#food',
  '/#menus',
  // Subdirectory pattern (rare but real)
  '/restaurant/menu',
  '/restaurant/dinner',
  '/restaurant/menus',
  // User-supplied
  '/dinner-fall',
];

const FOOD_KEYWORDS = [
  'Appetizers', 'Entrees', 'Desserts', 'Salads', 'Sides',
  'Chicken', 'Steak', 'Pasta', 'Seafood', 'Burgers'
];

const TIMEOUT = 8000;

async function fetchUrl(url, debug) {
  try {
    const res = await axios.get(url, { timeout: TIMEOUT, responseType: 'arraybuffer', validateStatus: s => s < 500 });
    if (debug) console.log(`[fetchUrl] ${url} -> status: ${res.status}`);
    return { status: res.status, headers: res.headers, data: res.data };
  } catch (e) {
    if (debug) console.log(`[fetchUrl] ${url} -> ERROR: ${e.message}`);
    return { status: null, headers: {}, data: null };
  }
}

function countFoodKeywords(text) {
  let count = 0;
  for (const word of FOOD_KEYWORDS) {
    const re = new RegExp(word, 'i');
    if (re.test(text)) count++;
  }
  return count;
}

// Structural menu detection: looks for menu-like classes, price patterns, headings/lists
function detectMenuStructure(html, debug) {
  const $ = cheerio.load(html);
  // 1. Look for menu-item/menu-section classes
  const menuClasses = ['menu-item', 'menu-section', 'menu-list', 'menu-category', 'menu-group', 'menu__item', 'menu__section'];
  let classHits = 0;
  for (const cls of menuClasses) {
    if ($(`.${cls}`).length > 2) {
      classHits++;
      if (debug) console.log(`[detectMenuStructure] Found >2 elements with class: .${cls}`);
    }
  }
  // 2. Look for price patterns (e.g., $12, 12.00, 12.5)
  const priceRegex = /\$\s?\d{1,3}(?:\.\d{2})?|\d{1,3}\.\d{2}/g;
  const priceMatches = (html.match(priceRegex) || []).length;
  if (debug && priceMatches > 3) console.log(`[detectMenuStructure] Found ${priceMatches} price patterns`);
  // 3. Look for menu-like headings/lists
  let headingHits = 0;
  $('h2,h3,h4').each((_, el) => {
    const txt = $(el).text().toLowerCase();
    if (txt.includes('menu') || txt.includes('dinner') || txt.includes('entree') || txt.includes('starters')) headingHits++;
  });
  if (debug && headingHits > 1) console.log(`[detectMenuStructure] Found ${headingHits} menu-like headings`);
  // 4. Look for lists with food keywords
  let listHits = 0;
  $('ul,ol').each((_, el) => {
    const txt = $(el).text();
    if (countFoodKeywords(txt) > 2) listHits++;
  });
  if (debug && listHits > 0) console.log(`[detectMenuStructure] Found ${listHits} menu-like lists`);
  // Decision logic
  // Prevent homepage false positive: require menu-related path
  // This function does not have URL, so add this check in tryScoredLinks and tryCommonPaths where detectMenuStructure is used
  if (classHits > 0) return { detected: true, detectionType: 'class' };
  if (priceMatches > 5) return { detected: true, detectionType: 'price' };
  if (headingHits > 1 && listHits > 0) return { detected: true, detectionType: 'heading-list' };
  return { detected: false };
}

async function tryCommonPaths(domain, debug) {
  let fallback = null;
  let fallbackScore = 0;
  let fallbackUrl = null;
  let fallbackHtml = null;
  for (const path of COMMON_PATHS) {
    // Ignore hash fragments
    const url = `https://${domain}${path}`.split('#')[0];
    if (debug) console.log(`[tryCommonPaths] Testing: ${url}`);
    const { status, headers, data } = await fetchUrl(url, debug);
    if (status === 200) {
      const ct = headers['content-type'] || '';
      if (ct.includes('application/pdf')) {
        if (debug) console.log(`[tryCommonPaths] PDF found: ${url}`);
        return { found: true, url, confidence: 95 };
      }
      if (ct.includes('text/html')) {
        // Structured detection for menu/menus paths (now always runs for /menus)
        if (url.includes("/menus")) {
          if (debug) console.log("Running structured detection on:", url);
          const structuredResult = await detectStructuredMenu(url);
          if (structuredResult.found) {
            return structuredResult;
          }
        }
        const html = data.toString('utf8');
        // Robust rejection: check for 404, short pages, or fake PDFs
        const htmlLower = html.toLowerCase();
        const is404 = htmlLower.includes('404 not found') || htmlLower.includes('page not found') || htmlLower.includes('does not exist') || htmlLower.includes('error 404') || htmlLower.includes('not found') || htmlLower.includes('document moved') || htmlLower.includes('site not found');
        const isShort = html.length < 1200; // Too short to be a real menu
        const isFakePdf = ct.includes('pdf') || /pdf/i.test(htmlLower) && !htmlLower.includes('<embed') && !htmlLower.includes('<object') && !htmlLower.includes('<iframe');
        if (is404 || isShort || isFakePdf) {
          if (debug) console.log(`[tryCommonPaths] Rejected HTML: ${url} (is404: ${is404}, isShort: ${isShort}, isFakePdf: ${isFakePdf})`);
          return { found: false, url, confidence: 0, detectionType: '404-reject', reason: { is404, isShort, isFakePdf } };
        }

        // --- TEMPORARY DEBUG: Print HTML and PDF link info ---
        const $ = cheerio.load(html);
        if (debug) {
          console.log('[tryCommonPaths][DEBUG] First 3000 chars of HTML:');
          console.log(html.slice(0, 3000));
        }
        const allATags = $('a');
        if (debug) {
          console.log(`[tryCommonPaths][DEBUG] Total <a> tags found: ${allATags.length}`);
        }
        let pdfLinks = [];
        allATags.each((_, el) => {
          let href = $(el).attr('href');
          if (href && href.toLowerCase().includes('.pdf')) {
            pdfLinks.push(href);
          }
        });
        if (debug) {
          console.log('[tryCommonPaths][DEBUG] All <a> hrefs containing .pdf:');
          pdfLinks.forEach(l => console.log(`  ${l}`));
        }
        // --- END TEMPORARY DEBUG ---
        // Score PDFs
        const year = new Date().getFullYear().toString();
        const monthPattern = `/${(new Date().getMonth()+1).toString().padStart(2,'0')}/`;
        let scoredPdfs = pdfLinks.map(link => {
          let score = 0;
          const l = link.toLowerCase();
          if (l.includes('dinner')) score += 50;
          if (l.includes('menu')) score += 40;
          if (l.includes(year)) score += 20;
          if (l.includes(monthPattern)) score += 10;
          if (l.includes('lunch')) score -= 40;
          return { link, score };
        });
        scoredPdfs.sort((a, b) => b.score - a.score);
        if (debug) {
          console.log(`[tryCommonPaths] Scored PDF links:`);
          scoredPdfs.forEach(p => console.log(`  ${p.link} (score: ${p.score})`));
        }
        // Test top 3 PDFs for validity
        for (let i = 0; i < Math.min(3, scoredPdfs.length); i++) {
          const pdfUrl = scoredPdfs[i].link;
          if (debug) console.log(`[tryCommonPaths] Testing PDF: ${pdfUrl}`);
          try {
            const { status: pdfStatus, headers: pdfHeaders, data: pdfData } = await fetchUrl(pdfUrl, debug);
            const contentType = pdfHeaders['content-type'] || '';
            const contentLength = parseInt(pdfHeaders['content-length'] || '0', 10);
            if (pdfStatus === 200 && contentType.includes('application/pdf') && contentLength > 20000) {
              if (debug) console.log(`[tryCommonPaths] Valid PDF found: ${pdfUrl} (content-length: ${contentLength})`);
              return { found: true, url: pdfUrl, confidence: 98, detectionType: 'pdf', method: 'static' };
            } else if (debug) {
              console.log(`[tryCommonPaths] PDF rejected: ${pdfUrl} (status: ${pdfStatus}, content-type: ${contentType}, content-length: ${contentLength})`);
            }
          } catch (e) {
            if (debug) console.log(`[tryCommonPaths] PDF fetch error: ${pdfUrl} (${e.message})`);
          }
        }
        // --- End PDF Extraction and Scoring Logic ---

        // Fallback to HTML structural detection
        const keywordCount = countFoodKeywords(html);
        if (debug) console.log(`[tryCommonPaths] HTML found: ${url}, food keywords: ${keywordCount}`);
        const struct = detectMenuStructure(html, debug);
        if (keywordCount >= 3 || struct.detected) {
          // Save as fallback, but check for better child links
          fallback = { found: true, url, confidence: 90, detectionType: struct.detected ? struct.detectionType : 'keywords' };
          fallbackScore = 90;
          fallbackUrl = url;
          fallbackHtml = html;
          // Extract internal links and score them
          let bestChild = null;
          let bestChildScore = fallbackScore;
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            const text = $(el).text();
            let norm = normalizeUrl(domain, href);
            if (!norm) return;
            const fullUrl = `https://${domain}${norm}`;
            let score = 0;
            const u = norm.toLowerCase();
            const t = (text || '').toLowerCase();
            if (u.includes('menu')) score += 50;
            if (u.includes('dinner')) score += 40;
            if (u.includes('dinner-')) score += 60;
            if (u.match(/fall|spring|summer|winter/)) score += 60;
            if (u.endsWith('.pdf')) score += 60;
            if (t.includes('menu')) score += 40;
            if (t.includes('dinner')) score += 35;
            if (t.includes('dinner-')) score += 60;
            if (t.match(/fall|spring|summer|winter/)) score += 60;
            // Score deeper paths higher
            if (u.split('/').length > 3) score += 10;
            if (debug) console.log(`[tryCommonPaths] Child link: ${fullUrl} (score: ${score})`);
            if (score > bestChildScore) {
              bestChild = { found: true, url: fullUrl, confidence: Math.min(100, score), parent: url, detectionType: struct.detected ? struct.detectionType : 'keywords' };
              bestChildScore = score;
            }
          });
          if (bestChild) {
            if (debug) console.log(`[tryCommonPaths] Returning best child: ${bestChild.url} (score: ${bestChildScore}) over parent: ${fallbackUrl}`);
            return bestChild;
          } else {
            if (debug) console.log(`[tryCommonPaths] Returning fallback parent: ${fallbackUrl}`);
            return fallback;
          }
        }
      }
    } else if (debug) {
      console.log(`[tryCommonPaths] Rejected: ${url} (status: ${status})`);
    }
  }
  return null;
}


// Enhanced normalizeUrl: allow external links if they are likely menu links or whitelisted
function normalizeUrl(domain, href) {
  if (!href) return null;
  if (href.startsWith('http')) {
    try {
      const u = new URL(href);
      const host = u.hostname.replace(/^www\./, '');
      const isSameDomain = host === domain.replace(/^www\./, '');
      // Whitelist for common menu hosting domains
      const whitelist = [
        'filesusr.com', 'cdn.', 'wp-content', 'cloudfront', 's3.amazonaws'
      ];
      const ordering = ['doordash', 'ubereats', 'grubhub', 'yelp'];
      // Reject known ordering platforms
      if (ordering.some(s => host.includes(s))) return null;
      // Allow if same domain
      if (isSameDomain) return u.pathname.endsWith('/') ? u.pathname : u.pathname + '/';
      // Allow if whitelisted domain
      if (whitelist.some(w => host.includes(w))) return href;
      // Allow if likely menu link
      const menuLike = /menu|dinner|lunch|brunch|food|\.pdf/i;
      if (menuLike.test(u.pathname) || menuLike.test(href)) return href;
      // Otherwise, reject
      return null;
    } catch { return null; }
  }
  if (href.startsWith('/')) return href.endsWith('/') ? href : href + '/';
  if (href.startsWith('#')) return null;
  return '/' + href.replace(/^\/+/,'') + '/';
}

function scoreLink(url, text, debug) {
  let score = 0;
  const u = url.toLowerCase();
  const t = (text || '').toLowerCase();
  if (u.includes('menu')) score += 50;
  if (u.includes('dinner')) score += 40;
  if (u.includes('lunch')) score += 30;
  if (u.match(/fall|spring|summer|winter/)) score += 40;
  if (u.endsWith('.pdf')) score += 60;
  if (t.includes('menu')) score += 40;
  if (t.includes('dinner')) score += 35;
  if (debug) console.log(`[scoreLink] url: ${url}, text: ${text}, score: ${score}`);
  return score;
}

async function extractAndScoreLinks(domain, baseUrl, html, testedSet, debug, contextLabel) {
  const $ = cheerio.load(html);
  const links = [];
  if (debug) console.log(`[extractAndScoreLinks] ${contextLabel}: extracting links...`);
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text();
    const norm = normalizeUrl(domain, href);
    if (!norm) {
      if (debug) console.log(`[extractAndScoreLinks] Rejected link (normalize fail or ordering/external): ${href}`);
      return;
    }
    // If norm is a full URL (external), use as is; otherwise, build full URL
    let fullUrl = norm.startsWith('http') ? norm : `https://${domain}${norm}`;
    if (testedSet.has(fullUrl)) {
      if (debug) console.log(`[extractAndScoreLinks] Skipping already tested: ${fullUrl}`);
      return;
    }
    const score = scoreLink(norm, text, debug);
    links.push({ url: fullUrl, score, text });
    testedSet.add(fullUrl);
    if (debug) console.log(`[extractAndScoreLinks] Added: ${fullUrl} (score: ${score})`);
  });
  if (debug) console.log(`[extractAndScoreLinks] ${contextLabel}: total links extracted: ${links.length}`);
  return links;
}

async function crawlLinks(domain, homepageHtml, testedSet, maxLinks = 20, debug = false) {
  let allLinks = await extractAndScoreLinks(domain, `https://${domain}/`, homepageHtml, testedSet, debug, 'homepage');
  if (debug) console.log(`[crawlLinks] Internal links from homepage:`);
  if (debug) allLinks.forEach(l => console.log(`  ${l.url} (score: ${l.score})`));
  // Find top-level crawl candidates (e.g. /menus/)
  const crawlCandidates = allLinks.filter(l => l.url.match(/\/menus\/?$/i));
  for (const candidate of crawlCandidates) {
    if (allLinks.length >= maxLinks) break;
    if (debug) console.log(`[crawlLinks] Crawling candidate: ${candidate.url}`);
    const { status, headers, data } = await fetchUrl(candidate.url, debug);
    if (status === 200 && headers['content-type'] && headers['content-type'].includes('text/html')) {
      const html = data.toString('utf8');
      if (debug) console.log(`[crawlLinks] HTML length for ${candidate.url}: ${html.length}`);
      const subLinks = await extractAndScoreLinks(domain, candidate.url, html, testedSet, debug, '/menus/');
      if (debug) {
        console.log(`[crawlLinks] Links from /menus/ page (${candidate.url}):`);
        subLinks.forEach(l => console.log(`  ${l.url} (score: ${l.score})`));
      }
      allLinks = allLinks.concat(subLinks);
      if (allLinks.length >= maxLinks) break;
    } else if (debug) {
      console.log(`[crawlLinks] Failed to fetch candidate: ${candidate.url} (status: ${status})`);
    }
  }
  // Deduplicate by URL
  const seen = new Set();
  return allLinks.filter(l => {
    if (seen.has(l.url)) return false;
    seen.add(l.url); return true;
  }).sort((a, b) => b.score - a.score).slice(0, maxLinks);
}

async function tryScoredLinks(links, debug) {
  let best = null;
  for (const { url, score } of links) {
    if (debug) console.log(`[tryScoredLinks] Testing: ${url} (score: ${score})`);
    const { status, headers, data } = await fetchUrl(url, debug);
    if (status === 200) {
      const ct = headers['content-type'] || '';
      if (ct.includes('application/pdf')) {
        if (debug) console.log(`[tryScoredLinks] PDF found: ${url}`);
        if (!best || score > best.score) best = { found: true, url, confidence: Math.min(100, score + 10), score, detectionType: 'pdf' };
        continue;
      }
      if (ct.includes('text/html')) {
        const html = data.toString('utf8');
        // Robust rejection: check for 404, short pages, or fake PDFs
        const htmlLower = html.toLowerCase();
        const is404 = htmlLower.includes('404 not found') || htmlLower.includes('page not found') || htmlLower.includes('does not exist') || htmlLower.includes('error 404') || htmlLower.includes('not found') || htmlLower.includes('document moved') || htmlLower.includes('site not found');
        const isShort = html.length < 1200;
        const isFakePdf = ct.includes('pdf') || /pdf/i.test(htmlLower) && !htmlLower.includes('<embed') && !htmlLower.includes('<object') && !htmlLower.includes('<iframe');
        if (is404 || isShort || isFakePdf) {
          if (debug) console.log(`[tryScoredLinks] Rejected HTML: ${url} (is404: ${is404}, isShort: ${isShort}, isFakePdf: ${isFakePdf})`);
          continue;
        }
        if (debug) console.log(`[tryScoredLinks] HTML length for ${url}: ${html.length}`);
        const keywordCount = countFoodKeywords(html);
        const struct = detectMenuStructure(html, debug);
        // Prevent homepage false positive: require menu-related path
        if ((keywordCount >= 3 || struct.detected) && (url.includes("menu") || url.includes("menus") || url.includes("dinner"))) {
          if (debug) console.log(`[tryScoredLinks] Accepting: ${url}`);
          if (!best || score > best.score) best = { found: true, url, confidence: Math.min(100, score + 5), score, detectionType: struct.detected ? struct.detectionType : 'keywords' };
        } else if (debug) {
          console.log(`[tryScoredLinks] Rejected: ${url} (food keywords: ${keywordCount}, structure: ${struct.detected ? struct.detectionType : 'none'})`);
        }
      }
    } else if (debug) {
      console.log(`[tryScoredLinks] Rejected: ${url} (status: ${status})`);
    }
  }
  return best;
}

export async function guessMenuUrl(domain, options = {}) {
  // Try common paths first
  const commonResult = await tryCommonPaths(domain, options.debug);
  if (commonResult && commonResult.found) {
    return { ...commonResult, method: 'static' };
  }
  // Fetch homepage and extract links
  const homepageUrl = `https://${domain}`;
  if (options.debug) console.log(`[guessMenuUrl] Fetching homepage: ${homepageUrl}`);
  const { status, headers, data } = await fetchUrl(homepageUrl, options.debug);
  if (status !== 200 || !headers['content-type'] || !headers['content-type'].includes('text/html')) {
    if (options.debug) console.log(`[guessMenuUrl] Homepage fetch failed or not HTML (status: ${status})`);
    return { found: false, url: null, confidence: 0, method: 'static' };
  }
  const homepageHtml = data.toString('utf8');
  if (options.debug) console.log(`[guessMenuUrl] Homepage HTML length: ${homepageHtml.length}`);
  const testedSet = new Set();
  // Crawl homepage and one level deep for /menus/ etc.
  const scoredLinks = await crawlLinks(domain, homepageHtml, testedSet, 20, options.debug);
  if (scoredLinks.length) {
    if (options.debug) {
      console.log(`[guessMenuUrl] Top scored links:`);
      scoredLinks.forEach(l => console.log(`  ${l.url} (score: ${l.score})`));
    }
    // Two-hop navigation: for anchors with score > 60, navigate, wait for network idle, rescan DOM
    let best = null;
    for (const link of scoredLinks) {
      if (link.score > 60) {
        if (!puppeteer) puppeteer = await import('puppeteer');
        let browser = null;
        let page = null;
        try {
          browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
          page = await browser.newPage();
          await page.goto(link.url, { waitUntil: "networkidle2", timeout: 20000 });
          await new Promise(r => setTimeout(r, 1200));
          const pageContent = await page.content();
          // PDF detection: scan for .pdf, filesusr, wp-content, uploads, cdn, menu?
          const anchors = await page.$$eval('a', els => els.map(el => ({ text: (el.textContent || '').trim(), href: el.getAttribute('href') || '' })));
          let pdfLinks = anchors.filter(a => /\.pdf|filesusr|wp-content|uploads|cdn|menu\?/i.test(a.href));
          pdfLinks = pdfLinks.filter(a => /menu|dinner|lunch/i.test(a.text));
          if (pdfLinks.length) {
            const absoluteUrl = new URL(pdfLinks[0].href, page.url()).href;
            await browser.close();
            return {
              found: true,
              url: absoluteUrl,
              confidence: 98,
              method: "two-hop-pdf",
              anchorIntent: pdfLinks[0].text
            };
          }
          // Structured menu signal boost
          const priceMatches = (pageContent.match(/\$\d+(\.\d{2})?/g) || []).length;
          const headings = await page.$$eval('h1,h2,h3,h4,h5,h6', els => els.map(e => e.textContent.toLowerCase()));
          const menuHeadings = headings.filter(h => /appetizer|entree|salad|burger|pasta/.test(h));
          const liCount = await page.$$eval('li', els => els.length);
          let confidenceBoost = 0;
          if (priceMatches >= 25) confidenceBoost += 10;
          if (menuHeadings.length >= 3) confidenceBoost += 10;
          if (liCount >= 15) confidenceBoost += 10;
          if (confidenceBoost > 0) link.score += 30;
          if (link.score > (best?.score || 0)) best = { ...link, confidence: link.score, method: 'two-hop-structured', priceMatches, menuHeadings: menuHeadings.length, liCount };
        } catch (e) {
          if (options.debug) console.log(`[guessMenuUrl] [two-hop] ERROR: ${e.message}`);
        } finally {
          if (browser) await browser.close();
        }
      }
    }
    // If best found via two-hop, return
    if (best) return { found: true, url: best.url, confidence: best.confidence, method: best.method, priceMatches: best.priceMatches, menuHeadings: best.menuHeadings, liCount: best.liCount };
    // Otherwise, try scored links as before
    const staticBest = await tryScoredLinks(scoredLinks, options.debug);
    if (staticBest) return { ...staticBest, method: 'static' };
  }
  // Headless fallback (homepage deep anchor scan)
  if (!puppeteer) puppeteer = await import('puppeteer');
  let browser = null;
  let page = null;
  let result = { found: false, url: null, confidence: 0, method: 'headless-dom-scan' };
  try {
    console.log("=== ENTERING HEADLESS MODE (DOM scan strategy) ===");
    const targetUrl = `https://${domain}`;
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
    page = await browser.newPage();
    await page.goto(targetUrl, {
      waitUntil: "networkidle2",
      timeout: 30000
    });
    await new Promise(r => setTimeout(r, 1500));
    // Deep anchor scan: click anchors with menu/dinner/lunch/food/eat/kitchen, rescan page
    const allLinks = await page.$$eval("a", els =>
      els.map(el => ({
        text: (el.textContent || "").trim(),
        href: el.getAttribute("href") || "",
        insideNav: !!el.closest('nav')
      }))
    );
    const navKeywords = /menu|dinner|lunch|food|eat|kitchen/i;
    for (const link of allLinks) {
      if (navKeywords.test(link.text) || navKeywords.test(link.href)) {
        try {
          const navUrl = new URL(link.href, page.url()).href;
          await page.goto(navUrl, { waitUntil: "networkidle2", timeout: 15000 });
          await new Promise(r => setTimeout(r, 1000));
          const pageContent = await page.content();
          // PDF detection
          const anchors = await page.$$eval('a', els => els.map(el => ({ text: (el.textContent || '').trim(), href: el.getAttribute('href') || '' })));
          let pdfLinks = anchors.filter(a => /\.pdf|filesusr|wp-content|uploads|cdn|menu\?/i.test(a.href));
          pdfLinks = pdfLinks.filter(a => /menu|dinner|lunch/i.test(a.text));
          if (pdfLinks.length) {
            const absoluteUrl = new URL(pdfLinks[0].href, page.url()).href;
            await browser.close();
            return {
              found: true,
              url: absoluteUrl,
              confidence: 98,
              method: "deep-anchor-pdf",
              anchorIntent: pdfLinks[0].text
            };
          }
          // Structured menu signal boost
          const priceMatches = (pageContent.match(/\$\d+(\.\d{2})?/g) || []).length;
          const headings = await page.$$eval('h1,h2,h3,h4,h5,h6', els => els.map(e => e.textContent.toLowerCase()));
          const menuHeadings = headings.filter(h => /appetizer|entree|salad|burger|pasta/.test(h));
          const liCount = await page.$$eval('li', els => els.length);
          let confidenceBoost = 0;
          if (priceMatches >= 25) confidenceBoost += 10;
          if (menuHeadings.length >= 3) confidenceBoost += 10;
          if (liCount >= 15) confidenceBoost += 10;
          let confidence = 60 + confidenceBoost;
          if (confidence >= 90) {
            await browser.close();
            return {
              found: true,
              url: page.url(),
              confidence,
              method: "deep-anchor-structured",
              priceMatches,
              menuHeadings: menuHeadings.length,
              liCount
            };
          }
        } catch (e) {
          if (options.debug) console.log(`[guessMenuUrl] [deep-anchor] ERROR: ${e.message}`);
        }
      }
    }
    if (browser) await browser.close();
    return {
      found: false,
      url: page.url(),
      confidence: 0,
      method: "headless-structured-html",
      reason: "No strong menu signals or density"
    };
  } catch (e) {
    if (options.debug) console.log(`[guessMenuUrl] [headless-dom-scan] ERROR: ${e.message}`);
  } finally {
    if (browser) await browser.close();
  }
  return { found: false, url: null, confidence: 0, method: 'headless-dom-scan' };
}

if (import.meta.url === process.argv[1]) {
  const domain = process.argv[2];
  const useHeadless = process.argv.includes('--headless');
  const debug = process.argv.includes('--debug');
  if (!domain) {
    console.error('Usage: node menuUrlGuesser.js <domain> [--headless] [--debug]');
    process.exit(1);
  }
  guessMenuUrl(domain, { useHeadless, debug }).then(result => {
    console.log(JSON.stringify(result, null, 2));
  });
}
