console.log("🔥 THIS EXACT FILE IS RUNNING: backend/server/index.js");
console.log("🔥 OFFICIAL TASTETRAILS BACKEND STARTED");
import { fileURLToPath } from 'url';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import menuRoutes from './routes/menu.js';
import followRequestsRoutes from './routes/followRequests.js';
import path from 'path';
import dotenv from 'dotenv';
import { discoverRestaurantURL } from '../services/urlDiscovery.js';
import scrapeMenuAgent from '../scraper/menuScraperAgent.js';

// Load environment variables from .env file
dotenv.config();

console.log("BACKEND ENTRY FILE EXECUTING");
process.on('exit', code => console.error('[EXIT EVENT]', code));
process.on('beforeExit', code => console.error('[BEFORE EXIT]', code));
process.on('uncaughtException', err => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  if (err && err.stack) console.error(err.stack);
});
process.on('unhandledRejection', err => {
  console.error('[UNHANDLED REJECTION]', err);
  if (err && err.stack) console.error(err.stack);
});
process.on('SIGTERM', () => {
  console.error('[SIGTERM] Received, shutting down.');
  process.exit(1);
});
process.on('SIGINT', () => {
  console.error('[SIGINT] Received, shutting down.');
  process.exit(1);
});

const app = express();
app.use((req, res, next) => {
  console.log("🔥 GLOBAL HIT:", req.method, req.url);
  next();
});
app.use((req, res, next) => {
  console.log("GLOBAL HIT:", req.method, req.url);
  next();
});

// OpenAI logic removed. AI disabled.
app.get('/__debug_openai', (req, res) => {
  res.status(501).json({ error: 'AI disabled' });
});
app.get('/__debug_openai_check', (req, res) => {
  res.status(501).json({ error: 'AI disabled' });
});
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || `http://localhost:5174`;
app.use(cors({
  origin: function(origin, cb) {
    if (!origin) return cb(null, true);
    try {
      const u = new URL(origin);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return cb(null, true);
    } catch(e) {}
    if (origin === FRONTEND_ORIGIN) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Register menu API routes
app.use('/', menuRoutes);
app.use('/api', menuRoutes);
app.use('/api', followRequestsRoutes);

// Health check endpoint (root-level for login connectivity)
app.get('/health', (req, res) => res.status(200).send('OK'));

// Health check endpoint (JSON response)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TasteTrails Backend',
    timestamp: new Date().toISOString()
  });
});

// Heartbeat log every 10 seconds
setInterval(() => {
  console.log(`[ALIVE] Server heartbeat at ${new Date().toISOString()}`);
}, 10000);

// Static file serving (for taste-trails/src/public or similar)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticDir = path.join(__dirname, '../../../src/public');
app.use('/static', express.static(staticDir));

app.get('/__test', (req, res) => res.end('OK'));
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});
app.get('/api/ping', (req, res) => {
  res.status(200).json({ pong: true, time: Date.now() });
});

// OpenAI logic removed. AI disabled.
app.get('/__debug_openai', (req, res) => {
  res.status(501).json({ error: 'AI disabled' });
});

// Debug endpoint to confirm server entry + resolver availability
app.get('/__whoami', (req, res) => {
  res.json({
    entry: 'taste-trails/backend/server/index.js',
    hasResolver: false,
    timestamp: new Date().toISOString()
  });
});

// OpenAI logic removed. AI disabled.
app.get('/__debug_openai_check', (req, res) => {
  res.status(501).json({ error: 'AI disabled' });
});

// Proxy endpoint to main app's find-menu-items to avoid CORS from the frontend
app.post('/api/find-menu-items-proxy', async (req, res) => {
  try {
    const body = req.body || {}
    // forward to main app on port 3000
    const target = process.env.MAIN_APP_URL || 'http://localhost:3000'
    // Axios removed. Replace with fetch or remove functionality if external call.
    return res.status(resp.status || 200).json(resp.data)
  } catch (e) {
    console.error('Proxy find-menu-items error:', e && e.response ? (e.response.data || e.response.statusText) : (e.message || String(e)))
    return res.status(500).json({ error: 'Proxy request failed', detail: e && e.response ? e.response.data : (e.message || String(e)) })
  }
})
// Example static route
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from TasteTrails backend!' });
});

// --- MENU LOGIC (READ-ONLY, NO SCRAPING/OCR) ---
// ...existing code...

// Returns the menu source info for a restaurant (Supabase cache, then auto-resolve)
// ...existing code...

// Returns the full menu for a restaurant
// ...existing code...

// Save a confirmed menu into Supabase so we don't need to re-run the AI parser for it
// ...existing code...

// Get list of all available restaurants from local filesystem
// ...existing code...

const DEFAULT_MIN_SCRAPE_CONFIDENCE = 0.8;
const TECH_GARBAGE_NAME_REGEX = /(bundle|worker|entrypoint|webpack|nextgen|nextgendash|videoplayer|wamedia|wasm|filehash|mainwebworker|chunk|sourcemap|source map|javascript|manifest)/i;
const NOISE_MENU_NAME_REGEX = /(^view\b.*\bmenu\b|^home$|^about$|^contact$|^menu$|^meta\b|privacy policy|terms of service|all rights reserved|\||©)/i;
const GARBAGE_REACTION_NAMES = new Set([
  'like', 'love', 'selfie', 'dorothy', 'toto', 'haha', 'yay', 'wow', 'confused', 'support', 'sorry', 'anger', 'flame', 'plane'
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resolveMinScrapeConfidence() {
  const parsed = Number(process.env.MIN_SCRAPE_CONFIDENCE);
  if (!Number.isFinite(parsed)) return DEFAULT_MIN_SCRAPE_CONFIDENCE;
  return clamp(parsed, 0, 1);
}

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizePrice(value = '') {
  const text = normalizeText(value);
  if (!text) return '';
  const match = text.match(/(\d{1,3}(?:\.\d{2})?)/);
  return match ? `$${match[1]}` : '';
}

function isLikelyMenuName(name = '') {
  const clean = normalizeText(name);
  if (!clean || clean.length < 2 || clean.length > 100) return false;
  if (TECH_GARBAGE_NAME_REGEX.test(clean)) return false;
  if (NOISE_MENU_NAME_REGEX.test(clean)) return false;
  if (GARBAGE_REACTION_NAMES.has(clean.toLowerCase())) return false;
  if (/,\s*[A-Z]{2}$/.test(clean)) return false;
  if (/\b\d{5}(?:-\d{4})?\b/.test(clean)) return false;
  if (!clean.includes(' ') && /[a-z][A-Z]/.test(clean) && clean.length > 14) return false;
  return true;
}

function flattenScrapedMenuItems(scraped = {}) {
  const sections = Array.isArray(scraped?.menu_sections) ? scraped.menu_sections : [];
  const flattened = [];

  for (const section of sections) {
    const sectionName = normalizeText(section?.section || section?.title || 'Menu') || 'Menu';
    const items = Array.isArray(section?.items) ? section.items : [];
    for (const raw of items) {
      if (typeof raw === 'string') {
        const text = normalizeText(raw);
        if (!text) continue;
        const priceMatch = text.match(/\$?\s?(\d{1,3}(?:\.\d{2})?)/);
        const name = normalizeText(priceMatch ? text.slice(0, priceMatch.index) : text);
        flattened.push({
          name,
          price: priceMatch ? `$${priceMatch[1]}` : '',
          description: '',
          category: sectionName
        });
      } else if (raw && typeof raw === 'object') {
        flattened.push({
          name: normalizeText(raw.name || raw.title || raw.dish_name || ''),
          price: normalizePrice(raw.price || raw.amount || ''),
          description: normalizeText(raw.description || ''),
          category: normalizeText(raw.category || sectionName) || 'Menu'
        });
      }
    }
  }

  return flattened;
}

function sanitizeMenuItems(items = []) {
  const source = Array.isArray(items) ? items : [];
  const seen = new Set();
  const out = [];

  for (const raw of source) {
    const name = normalizeText(raw?.name);
    const description = normalizeText(raw?.description);
    const price = normalizePrice(raw?.price);
    const category = normalizeText(raw?.category || 'Menu') || 'Menu';

    if (!isLikelyMenuName(name)) continue;
    if (!price && !description && !name.includes(' ')) continue;

    const key = `${name.toLowerCase()}|${price.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ name, description, price, category });
  }

  return out;
}

function buildCategories(items = []) {
  const categoryMap = {};
  for (const item of Array.isArray(items) ? items : []) {
    const cat = item?.category || 'Menu';
    if (!categoryMap[cat]) categoryMap[cat] = [];
    categoryMap[cat].push({
      name: item?.name || '',
      description: item?.description || '',
      price: item?.price || ''
    });
  }
  return Object.entries(categoryMap).map(([category, categoryItems]) => ({
    category,
    items: categoryItems
  }));
}

// Get specific restaurant info and menu
app.get('/api/restaurants/:name', async (req, res) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const restaurantsDir = path.join(__dirname, '../../restaurants');
    
    const requestedName = decodeURIComponent(req.params.name);
    const forceRefresh = ['1', 'true', 'yes'].includes(String(req.query.refresh || '').toLowerCase());
    const minScrapeConfidence = resolveMinScrapeConfidence();
    
    // Normalize for matching
    const normalize = (str) => str.toLowerCase().replace(/[\s_'-]+/g, '_');
    const requestedNorm = normalize(requestedName);
    
    // Try exact match first
    let actualDir = path.join(restaurantsDir, requestedName.replace(/[\s-]+/g, '_').replace(/['']/g, ''));
    
    // If not found, search for case-insensitive match
    if (!fs.existsSync(actualDir)) {
      try {
        const directories = fs.readdirSync(restaurantsDir).filter(d => 
          fs.statSync(path.join(restaurantsDir, d)).isDirectory()
        );
        
        const matched = directories.find(d => normalize(d) === requestedNorm);
        
        if (matched) {
          actualDir = path.join(restaurantsDir, matched);
        }
      } catch (e) {
        console.warn('Error reading directories:', e.message);
      }
    }
    
    const menuPath = path.join(actualDir, 'menu.json');
    const menuMetaPath = path.join(actualDir, 'menu.meta.json');

    let cachedItems = [];
    let cachedMeta = null;
    if (fs.existsSync(menuPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
        cachedItems = sanitizeMenuItems(parsed);
      } catch (_) {
        cachedItems = [];
      }
    }
    if (fs.existsSync(menuMetaPath)) {
      try {
        cachedMeta = JSON.parse(fs.readFileSync(menuMetaPath, 'utf8'));
      } catch (_) {
        cachedMeta = null;
      }
    }

    const cachedScrapeConfidence = Number(cachedMeta?.scrape_confidence);
    const cachedIsConfident =
      Number.isFinite(cachedScrapeConfidence) &&
      cachedScrapeConfidence >= minScrapeConfidence &&
      cachedItems.length >= 8;

    if (!forceRefresh && cachedIsConfident) {
      return res.json({
        name: path.basename(actualDir).replace(/_/g, ' '),
        id: path.basename(actualDir),
        itemCount: cachedItems.length,
        categories: buildCategories(cachedItems),
        menu: cachedItems,
        source_url: cachedMeta?.source_url || null,
        url_confidence: Number(cachedMeta?.url_confidence || 0),
        url_discovery_method: cachedMeta?.url_discovery_method || null,
        scrape_confidence: cachedScrapeConfidence,
        min_scrape_confidence: minScrapeConfidence,
        cached: true
      });
    }

    const discovery = await discoverRestaurantURL(requestedName);
    if (!discovery?.url) {
      return res.status(404).json({
        error: 'Menu URL not found',
        url_confidence: Number(discovery?.confidence || 0),
        url_discovery_method: discovery?.method || null,
        url_confidence_report: discovery?.confidence_report || null
      });
    }

    const scrapeResult = await scrapeMenuAgent(discovery.url);
    const scrapeConfidence = Number(scrapeResult?.confidence || 0);
    const scrapedItems = sanitizeMenuItems(flattenScrapedMenuItems(scrapeResult));

    if (!Number.isFinite(scrapeConfidence) || scrapeConfidence < minScrapeConfidence || scrapedItems.length < 8) {
      return res.status(422).json({
        error: `Scraped menu rejected: confidence ${scrapeConfidence.toFixed(2)} is below minimum ${minScrapeConfidence.toFixed(2)} or menu too small`,
        source_url: discovery.url,
        url_confidence: Number(discovery.confidence || 0),
        url_discovery_method: discovery.method || null,
        url_confidence_report: discovery.confidence_report || null,
        scrape_confidence: scrapeConfidence,
        scrape_confidence_report: scrapeResult?.confidence_report || null,
        min_scrape_confidence: minScrapeConfidence,
        item_count: scrapedItems.length
      });
    }

    fs.mkdirSync(actualDir, { recursive: true });
    fs.writeFileSync(menuPath, JSON.stringify(scrapedItems, null, 2), 'utf8');
    fs.writeFileSync(menuMetaPath, JSON.stringify({
      source_url: discovery.url,
      url_confidence: Number(discovery.confidence || 0),
      url_discovery_method: discovery.method || null,
      scrape_confidence: scrapeConfidence,
      min_scrape_confidence: minScrapeConfidence,
      updated_at: new Date().toISOString()
    }, null, 2), 'utf8');

    return res.json({
      name: path.basename(actualDir).replace(/_/g, ' '),
      id: path.basename(actualDir),
      itemCount: scrapedItems.length,
      categories: buildCategories(scrapedItems),
      menu: scrapedItems,
      source_url: discovery.url,
      url_confidence: Number(discovery.confidence || 0),
      url_discovery_method: discovery.method || null,
      url_confidence_report: discovery.confidence_report || null,
      scrape_confidence: scrapeConfidence,
      scrape_confidence_report: scrapeResult?.confidence_report || null,
      min_scrape_confidence: minScrapeConfidence,
      refreshed: true
    });
  } catch (err) {
    console.error('/api/restaurants/:name error:', err.message);
    res.status(500).json({ error: 'Failed to fetch restaurant' });
  }
});

const PORT = process.env.PORT || 8081;
const HOST = '0.0.0.0';
console.log(`Server is attempting to start on port: ${PORT}`);
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`TasteTrails backend server running on http://${HOST}:${PORT} (all interfaces)`);
});
