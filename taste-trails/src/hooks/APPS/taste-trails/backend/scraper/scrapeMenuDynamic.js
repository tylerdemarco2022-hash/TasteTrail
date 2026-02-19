import path from 'path';
import fs from 'fs';
import { chromium } from 'playwright'
// (imports already declared above)
import { fileURLToPath } from 'url';
// Load manual_menu_sources.json synchronously for compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manualMenuSourcesPath = path.join(__dirname, 'manual_menu_sources.json');
let manualMenuSourcesRaw = {};
try {
  manualMenuSourcesRaw = JSON.parse(fs.readFileSync(manualMenuSourcesPath, 'utf8'));
} catch (e) {
  console.error('Failed to load manual_menu_sources.json:', e.message);
}
// Normalize manual sources to new format
function normalizeKey(s) {
  return (s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
const manualMenuSources = {};
for (const [k, v] of Object.entries(manualMenuSourcesRaw)) {
  if (typeof v === 'string') {
    // legacy: just a URL
    manualMenuSources[normalizeKey(k)] = {
      source_url: v,
      source_type: v.endsWith('.pdf') ? 'PDF' : v.match(/\.(jpg|jpeg|png)$/i) ? 'IMAGE' : 'HTML',
      confidence: 1.0
    };
  } else {
    manualMenuSources[normalizeKey(k)] = v;
  }
}

// --- SerpApi/Google Search JSON menu source extraction ---
function extractMenuSourcesFromSearchJson(searchJson) {
  const candidates = [];
  const knownMenuPlatforms = ['toasttab.com', 'clover.com', 'square.site', 'menupages.com', 'ubereats.com', 'doordash.com', 'grubhub.com'];
  function isMenuUrl(url) {
    if (!url) return false;
    const u = url.toLowerCase();
    if (u.includes('/menu') || knownMenuPlatforms.some(dom => u.includes(dom))) return true;
    return false;
  }
  // 1. Organic results
  if (Array.isArray(searchJson.organic_results)) {
    for (const r of searchJson.organic_results) {
      if (isMenuUrl(r.link)) {
        candidates.push({
          source_url: r.link,
          found_via: 'serpapi_search',
          confidence_score: 0.9,
          title: r.title || '',
          snippet: r.snippet || ''
        });
      }
    }
  }
  // 2. Local results
  if (searchJson.local_results && Array.isArray(searchJson.local_results.places)) {
    for (const p of searchJson.local_results.places) {
      if (isMenuUrl(p.website)) {
        candidates.push({
          source_url: p.website,
          found_via: 'serpapi_search',
          confidence_score: 0.95,
          title: p.title || '',
          address: p.address || ''
        });
      }
    }
  }
  // Filter out review-only pages
  return candidates.filter(c => !/yelp|tripadvisor|opentable/.test(c.source_url));
}
import { processMenuWithOCR } from '../agent/ocr_agent.js';
// (duplicate import removed)
// (duplicate import removed)
import fetch from 'node-fetch'

function safeRestaurantDir(name) {
  const safe = (name || 'restaurant').replace(/[^a-z0-9]/gi, '_') || 'restaurant'
  return path.join(path.dirname(__dirname), 'restaurants', safe)
}

async function detectMenuFormat(page) {
  const url = page.url().toLowerCase()
  const contentType = await page.evaluate(() => document.contentType || '')
  
  if (url.includes('.pdf') || contentType.includes('pdf')) {
    return { type: 'PDF', url }
  }
  if (contentType.includes('image')) {
    return { type: 'IMAGE', url }
  }
  
  // Check for embedded PDFs or image links on page
  const embeddedMedia = await page.evaluate(() => {
    const pdfs = Array.from(document.querySelectorAll('iframe[src*=".pdf"], a[href*=".pdf"], embed[src*=".pdf"]'))
      .map(el => el.src || el.href)
      .filter(Boolean)
    
    const images = Array.from(document.querySelectorAll('img[src*="menu"]'))
      .map(el => el.src)
      .filter(Boolean)
    
    return { pdfs: [...new Set(pdfs)], images: [...new Set(images)] }
  })
  
  if (embeddedMedia.pdfs.length > 0) {
    const pdfUrl = new URL(embeddedMedia.pdfs[0], page.url()).toString()
    return { type: 'PDF', url: pdfUrl, embedded: true }
  }
  
  if (embeddedMedia.images.length > 0) {
    const imgUrl = new URL(embeddedMedia.images[0], page.url()).toString()
    return { type: 'IMAGE', url: imgUrl, embedded: true }
  }
  
  return { type: 'HTML', url: page.url() }
}

async function downloadPDF(url, restaurant) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    
    const buffer = await response.buffer()
    const dir = safeRestaurantDir(restaurant)
    fs.mkdirSync(dir, { recursive: true })
    const pdfPath = path.join(dir, 'menu.pdf')
    fs.writeFileSync(pdfPath, buffer)
    
    console.log(`📄 Downloaded PDF: ${pdfPath}`)
    return pdfPath
  } catch (error) {
    console.error(`Failed to download PDF: ${error.message}`)
    return null
  }
}

async function extractTextFromPDF(pdfPath) {
  try {
    // Try using pdfparse if available
    const pdfParse = await import('pdf-parse/lib/pdf.js').catch(() => null)
    if (!pdfParse) {
      console.warn('pdf-parse not installed. Returning PDF path for OCR.')
      return null
    }
    
    const dataBuffer = fs.readFileSync(pdfPath)
    const data = await pdfParse(dataBuffer)
    
    const text = data.text || ''
    if (!text.trim()) {
      console.warn('PDF text extraction returned empty. Falling back to OCR.')
      return null
    }
    
    console.log(`✅ Extracted ${text.length} characters from PDF`)
    return text
  } catch (error) {
    console.warn(`PDF text extraction failed: ${error.message}. Will use OCR.`)
    return null
  }
}

function parseMenuText(text, restaurant) {
  const lines = text.split('\n').filter(l => l.trim())
  const priceRegex = /\$\s?(\d{1,3}(?:\.\d{1,2})?)/g
  
  const items = []
  for (const line of lines) {
    if (line.length < 5 || line.length > 200) continue
    if (/copyright|privacy|contact|home|about|hours/i.test(line)) continue
    
    const prices = [...line.matchAll(priceRegex)].map(m => parseFloat(m[1])).filter(n => !Number.isNaN(n))
    if (!prices.length) continue
    
    const name = line.replace(priceRegex, '').trim()
    if (name.length < 3) continue
    
    items.push({
      name,
      price: prices[0],
      category: 'Menu Item'
    })
  }
  
  // Group into categories
  const categories = items.length > 0 ? [{ category: 'Menu Items', items: items.slice(0, 50) }] : []
  return categories
}

async function findOfficialWebsite(page, restaurant, location) {
  const searchQuery = `${restaurant} official menu ${location || ''}`
  await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  await page.waitForTimeout(1500)

  const nameTokens = restaurant.toLowerCase().split(/\s+/).filter(Boolean)
  const websiteUrl = await page.evaluate(({ nameTokens }) => {
    const skipDomains = ['google', 'yelp', 'tripadvisor', 'opentable', 'doordash', 'ubereats', 'grubhub', 'facebook', 'instagram', 'wikipedia']
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map((link, idx) => ({ href: link.href, text: (link.textContent || '').toLowerCase(), idx }))
      .filter((l) => l.href && l.href.startsWith('http'))
      .filter((l) => {
        try {
          const domain = new URL(l.href).hostname.toLowerCase()
          return !skipDomains.some((d) => domain.includes(d))
        } catch {
          return false
        }
      })

    const scored = links.map((l) => {
      const domain = new URL(l.href).hostname.toLowerCase()
      const scoreName = nameTokens.reduce((s, t) => s + (domain.includes(t) || l.text.includes(t) ? 1 : 0), 0)
      const scoreMenu = l.href.toLowerCase().includes('menu') || l.text.includes('menu') ? 2 : 0
      return { ...l, score: scoreName + scoreMenu }
    })

    scored.sort((a, b) => b.score - a.score || a.idx - b.idx)
    return scored.length ? scored[0].href : null
  }, { nameTokens })

  return websiteUrl
}

async function navigateToMenu(page, startUrl) {
  const response = await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (!response) return false
  await page.waitForTimeout(1500)

  const current = page.url().toLowerCase()
  if (current.includes('menu')) return true

  const menuHref = await page.evaluate(() => {
    const selectors = ['a[href*="menu"]', 'a[href*="food"]', '[class*="menu"] a', 'nav a']
    for (const selector of selectors) {
      for (const el of Array.from(document.querySelectorAll(selector))) {
        const text = (el.textContent || '').toLowerCase()
        const href = el.getAttribute('href') || ''
        if (!href || href.startsWith('javascript')) continue
        if (text.includes('menu') || href.toLowerCase().includes('menu')) return href
      }
    }
    return null
  })

  if (menuHref) {
    const target = new URL(menuHref, page.url()).toString()
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1200)
    return true
  }
  return true
}

async function scrapeFullMenu(page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(1000)

  return await page.evaluate(() => {
    const priceRegex = /\$\s?(\d{1,3}(?:\.\d{1,2})?)/g
    const blacklist = /copyright|privacy|follow|contact|home|about|location|hours/i

    const clean = (t) => (t || '').replace(/\s+/g, ' ').trim()
    const collect = (nodes) => {
      const items = []
      nodes.forEach((n) => {
        const text = clean(n.textContent)
        if (!text || text.length < 4 || text.length > 400) return
        if (blacklist.test(text)) return
        const prices = [...text.matchAll(priceRegex)].map((m) => parseFloat(m[1])).filter((n) => !Number.isNaN(n))
        if (!prices.length) return
        const name = clean(text.replace(priceRegex, '').trim())
        if (!name || name.length < 3) return
        items.push({ name, prices })
      })
      return items
    }

    const categories = []
    const headingSel = 'h1, h2, h3, h4, h5, strong, b, [class*="category"], [class*="section"], [class*="menu"]'
    const headings = Array.from(document.querySelectorAll(headingSel))

    if (headings.length) {
      headings.forEach((h, idx) => {
        const title = clean(h.textContent)
        if (!title || title.length > 120 || blacklist.test(title)) return
        const section = []
        let node = h.nextElementSibling
        while (node && !headings.includes(node)) {
          section.push(node)
          node = node.nextElementSibling
        }
        const items = collect(section.length ? section : [h])
        if (items.length) categories.push({ category: title, items })
      })
    }

    if (!categories.length) {
      const all = Array.from(document.querySelectorAll('p, li, div, span'))
      const items = collect(all)
      if (items.length) categories.push({ category: 'Menu', items })
    }

    return categories
  })
}

export async function scrapeMenuDynamic(restaurant, location = 'Charlotte NC', opts = {}) {
  // Step 1: Manual override check (normalized)
  const normName = normalizeKey(restaurant);
  if (manualMenuSources[normName]) {
    const entry = manualMenuSources[normName];
    return {
      success: true,
      menu_source: entry,
      how_found: 'manual_override',
      log: { source: 'manual', confidence: entry.confidence }
    };
  }

  // Step 2: SerpApi/Google search JSON support
  if (opts.searchJson) {
    const candidates = extractMenuSourcesFromSearchJson(opts.searchJson);
    if (candidates.length > 0) {
      // Pick highest confidence
      const best = candidates.sort((a, b) => b.confidence_score - a.confidence_score)[0];
      return {
        success: true,
        menu_source: best,
        how_found: 'serpapi_search',
        log: { source: 'serpapi', confidence: best.confidence_score }
      };
    }
    // No valid menu found in search JSON
    return {
      success: false,
      error: 'No authoritative menu source found in search results',
      log: { source: 'serpapi', candidates: candidates.length }
    };
  }

  // Step 3: Fallback to dynamic scraping (legacy, only if allowed)
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    // 1. Support overrideSource/overrideType for strict menu source
    let website = null;
    let format = null;
    if (opts.overrideSource && opts.overrideType) {
      website = opts.overrideSource;
      format = { type: opts.overrideType, url: opts.overrideSource };
    } else {
      // (legacy fallback, not used if searchJson/manual present)
    }
    
    // Handle PDF
    if (format.type === 'PDF') {
      console.log(`📄 Detected PDF menu at: ${format.url}`)
      const pdfPath = await downloadPDF(format.url, restaurant)
      if (pdfPath) {
        const extractedText = await extractTextFromPDF(pdfPath)
        if (extractedText) {
          // Successfully extracted text from PDF
          const categories = parseMenuText(extractedText, restaurant)
          const structured = categories.map((c) => ({
            category: c.category,
            items: c.items.map((i) => ({
              name: i.name,
              price: Number(i.price) || 0
            })).filter((i) => i.price > 0)
          })).filter((c) => c.items.length)
          // --- VALIDATION ---
          const validation = validateMenu(structured)
          if (!validation.valid) {
            return { success: false, error: validation.reason, validation }
          }
          if (structured.length > 0) {
            const payload = {
              restaurant,
              location,
              websiteUrl: website,
              scrapedAt: new Date().toISOString(),
              categories: structured,
              totalItems: structured.reduce((sum, c) => sum + c.items.length, 0),
              source: 'PDF'
            }
            const dir = safeRestaurantDir(restaurant)
            fs.mkdirSync(dir, { recursive: true })
            const outPath = path.join(dir, 'menu.json')
            fs.writeFileSync(outPath, JSON.stringify(payload, null, 2))
            return { success: true, savedPath: outPath, menu: payload }
          }
        }
        // PDF extraction failed, try AI OCR agent
        const ocrResult = await processMenuWithOCR(pdfPath, null, restaurant, location)
        if (ocrResult.success && ocrResult.menu) {
          const structured = ocrResult.menu.categories || [];
          const validation = validateMenu(structured)
          if (!validation.valid) {
            return { success: false, error: validation.reason, validation }
          }
          const payload = {
            restaurant,
            location,
            websiteUrl: website,
            scrapedAt: new Date().toISOString(),
            categories: structured,
            totalItems: ocrResult.menu.totalItems || 0,
            source: 'AI_OCR'
          }
          const dir = safeRestaurantDir(restaurant)
          fs.mkdirSync(dir, { recursive: true })
          const outPath = path.join(dir, 'menu.json')
          fs.writeFileSync(outPath, JSON.stringify(payload, null, 2))
          return { success: true, savedPath: outPath, menu: payload }
        }
        // If OCR fails, return error as before
        return {
          success: false,
          error: 'NEEDS_OCR',
          format: 'PDF',
          pdfPath: pdfPath,
          websiteUrl: website,
          message: 'PDF menu downloaded but text extraction failed. OCR processing required.'
        }
      }
    }

    // Handle IMAGE
    if (format.type === 'IMAGE') {
      console.log(`🖼️  Detected image menu at: ${format.url}`)
      const dir = safeRestaurantDir(restaurant)
      fs.mkdirSync(dir, { recursive: true })
      const imagePath = path.join(dir, 'menu-image.jpg')
      // Download image for OCR
      const response = await fetch(format.url)
      if (response.ok) {
        const buffer = await response.buffer()
        fs.writeFileSync(imagePath, buffer)
        console.log(`🖼️  Downloaded menu image: ${imagePath}`)
      }
      // Try AI OCR agent
      const ocrResult = await processMenuWithOCR(null, imagePath, restaurant, location)
      if (ocrResult.success && ocrResult.menu) {
        const structured = ocrResult.menu.categories || [];
        const validation = validateMenu(structured)
        if (!validation.valid) {
          return { success: false, error: validation.reason, validation }
        }
        const payload = {
          restaurant,
          location,
          websiteUrl: website,
          scrapedAt: new Date().toISOString(),
          categories: structured,
          totalItems: ocrResult.menu.totalItems || 0,
          source: 'AI_OCR'
        }
        const outPath = path.join(dir, 'menu.json')
        fs.writeFileSync(outPath, JSON.stringify(payload, null, 2))
        return { success: true, savedPath: outPath, menu: payload }
      }
      // If OCR fails, return error as before
      return {
        success: false,
        error: 'NEEDS_OCR',
        format: 'IMAGE',
        imagePath: imagePath,
        imageUrl: format.url,
        websiteUrl: website,
        message: 'Menu image detected. OCR processing required.'
      }
    }

    // Handle HTML
    const categories = await scrapeFullMenu(page)
    if (!categories?.length) return { success: false, error: 'No menu items with numeric prices found', log: { source: 'html_scrape', result: 'empty' } }

    const structured = categories.map((c) => ({
      category: c.category,
      items: c.items.map((i) => ({
        name: i.name,
        price: Number(i.prices[0]) || 0
      })).filter((i) => i.price > 0)
    })).filter((c) => c.items.length)

    // --- VALIDATION ---
    const validation = validateMenu(structured)
    if (!validation.valid) {
      return { success: false, error: validation.reason, validation, log: { source: 'html_scrape', result: 'invalid' } }
    }

    const payload = {
      restaurant,
      location,
      websiteUrl: website,
      scrapedAt: new Date().toISOString(),
      categories: structured,
      totalItems: structured.reduce((sum, c) => sum + c.items.length, 0),
      source: 'HTML'
    }

    const dir = safeRestaurantDir(restaurant)
    fs.mkdirSync(dir, { recursive: true })
    const outPath = path.join(dir, 'menu.json')
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2))

    return { success: true, savedPath: outPath, menu: payload, log: { source: 'html_scrape', result: 'success' } }
  } catch (error) {
    return { success: false, error: error.message, log: { source: 'html_scrape', result: 'error', details: error.message } }
  } finally {
    await browser.close()
  }
}

// --- Menu validation rules ---
function validateMenu(categories) {
  // 1. At least 10 items
  const itemCount = categories.reduce((sum, c) => sum + c.items.length, 0)
  if (itemCount < 10) return { valid: false, reason: 'Too few menu items (<10)', itemCount }
  // 2. At least 1 category with a real name
  if (!categories.length || categories.every(c => !c.category || c.category.toLowerCase().includes('menu'))) {
    return { valid: false, reason: 'No real menu categories found', categories }
  }
  // 3. No generic/placeholder content
  const genericPatterns = [/lorem ipsum/i, /sample item/i, /test dish/i, /placeholder/i, /item \d+/i]
  for (const cat of categories) {
    for (const item of cat.items) {
      if (genericPatterns.some(r => r.test(item.name))) {
        return { valid: false, reason: 'Menu contains generic or placeholder items', item: item.name }
      }
    }
  }
  return { valid: true }
}

// CLI
// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const name = process.argv[2]
  const loc = process.argv[3] || 'Charlotte NC'
  if (!name) {
    console.log('Usage: node backend/scraper/scrapeMenuDynamic.js "<Restaurant>" "[Location]"')
    // Do not exit process in module context
  } else {
    scrapeMenuDynamic(name, loc).then((res) => {
      console.log(JSON.stringify(res, null, 2))
      // Do not exit process in module context
    })
  }
}
