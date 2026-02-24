console.log("🔥 OFFICIAL TASTETRAILS BACKEND STARTED");
import { fileURLToPath } from 'url';
import fs from 'fs';
import { supabase } from '../backend/supabase.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import * as Sentry from '@sentry/node';
import menuRoutes from '../backend/server/routes/menu.js';
import nearbyRoutes from '../backend/server/routes/nearby.js';
import followRequestsRoutes from '../backend/server/routes/followRequests.js';
import authRoutes from './routes/auth.js';
import userPrefsRoutes from './routes/userPrefs.js';
import moderationRoutes from './routes/moderation.js';
import { resolveMenuSource } from './menu_source_resolver.js';
import { discoverRestaurantURL } from '../backend/services/urlDiscovery.js';
import { scrapeMenu as scrapeMenuAgent } from '../backend/scraper/menuScraperAgent.js';
import {
  buildMenuCompletenessReport,
  passesMenuCompleteness,
  sanitizeMenuItems as sanitizeMenuItemsShared,
  flattenScrapedMenuItems as flattenScrapedMenuItemsShared
} from '../backend/services/menuQuality.js';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENABLED = process.env.NODE_ENV === 'production' && !!SENTRY_DSN;

function redactSensitive(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (typeof value === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('token') || lowerKey.includes('password') || lowerKey.includes('authorization')) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactSensitive(val);
      }
    }
    return result;
  }
  return value;
}

if (SENTRY_ENABLED) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.2,
    beforeSend(event) {
      if (event.request) {
        event.request.cookies = undefined;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
          delete event.request.headers['set-cookie'];
        }
        if (event.request.data) {
          event.request.data = redactSensitive(event.request.data);
        }
      }
      return event;
    }
  });
}

console.log("BACKEND ENTRY FILE EXECUTING");
process.on('exit', code => console.error('[EXIT EVENT]', code));
process.on('beforeExit', code => console.error('[BEFORE EXIT]', code));
process.on('uncaughtException', err => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  if (err && err.stack) console.error(err.stack);
  if (SENTRY_ENABLED) {
    Sentry.captureException(err);
  }
});
process.on('unhandledRejection', err => {
  console.error('[UNHANDLED REJECTION]', err);
  if (err && err.stack) console.error(err.stack);
  if (SENTRY_ENABLED) {
    Sentry.captureException(err);
  }
});
process.on('SIGTERM', () => {
  console.error('[SIGTERM] Received, shutting down.');
  process.exit(1);
});
process.on('SIGINT', () => {
  console.error('[SIGINT] Received, shutting down.');
  process.exit(1);
});

// OpenAI disabled: do not load or use OPENAI_API_KEY.
// try {
//   const hasKey = !!process.env.OPENAI_API_KEY && !String(process.env.OPENAI_API_KEY).includes('your-openai');
//   if (!hasKey) {
//     const __filename = fileURLToPath(import.meta.url);
//     const __dirname = path.dirname(__filename);
//     const rootEnv = path.join(__dirname, '../../.env');
//     if (fs.existsSync(rootEnv)) {
//       const envText = fs.readFileSync(rootEnv, 'utf8');
//       const m = envText.match(/OPENAI_API_KEY\s*=\s*(.+)/);
//       if (m && m[1]) {
//         process.env.OPENAI_API_KEY = m[1].trim().replace(/^\s*\"|\"\s*$/g, '').replace(/^\'|\'$/g, '');
//         console.log('Loaded OPENAI_API_KEY from workspace root .env');
//       }
//     }
//   }
// } catch (e) {
//   console.warn('Could not load OPENAI_API_KEY from root .env:', e && e.message);
// }

process.on('exit', code => console.error('[EXIT EVENT]', code));
process.on('beforeExit', code => console.error('[BEFORE EXIT]', code));
process.on('uncaughtException', err => console.error('[UNCAUGHT]', err));
process.on('unhandledRejection', err => console.error('[UNHANDLED]', err));

// Use resilient supabase client from backend wrapper (may be a no-op client when env missing)
// const supabase = supabaseClient;


const app = express();
app.set('trust proxy', 1);
if (SENTRY_ENABLED) {
  app.use(Sentry.Handlers.requestHandler());
}
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
app.use(cookieParser());
app.use((req, res, next) => {
  console.log("INCOMING REQUEST:", req.method, req.path);
  next();
});
// Register menu API routes
app.use('/api', menuRoutes);
app.use('/api', nearbyRoutes);
app.use('/api', followRequestsRoutes);
app.use('/api', moderationRoutes);
console.log("REGISTERING /auth ROUTES");
app.use("/auth", authRoutes);
app.use("/api", userPrefsRoutes);

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
const staticDir = path.join(__dirname, '../src/public');
app.use('/static', express.static(staticDir));

app.get('/__test', (req, res) => res.end('OK'));
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});
app.get('/api/ping', (req, res) => {
  res.status(200).json({ pong: true, time: Date.now() });
});

// Debug endpoint to inspect OPENAI key presence (masked)
app.get('/__debug_openai', (req, res) => {
  res.json({ ai_disabled: true });
});

// Debug endpoint to confirm server entry + resolver availability
app.get('/__whoami', (req, res) => {
  res.json({
    entry: 'taste-trails/server/index.js',
    hasResolver: typeof resolveMenuSource === 'function',
    hasSupabase: !!supabase,
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to check OpenAI auth using the server's key (no key returned)
app.get('/__debug_openai_check', async (req, res) => {
  return res.json({ ai_disabled: true });
});

// Proxy endpoint to main app's find-menu-items to avoid CORS from the frontend
app.post('/api/find-menu-items-proxy', async (req, res) => {
  try {
    const body = req.body || {}
    // forward to main app on port 3000
    const target = process.env.MAIN_APP_URL || 'http://localhost:3000'
    const axios = await import('axios').then(m => m.default || m)
    const resp = await axios.post(`${target}/api/find-menu-items`, body, { timeout: 120000 })
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

// Example Supabase test endpoint
app.get('/api/supabase-test', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_KEY or SUPABASE_KEY.' });
  }
  // DNS/HTTPS connectivity check
  const url = SUPABASE_URL;
  if (!url) {
    return res.status(500).json({ error: 'SUPABASE_URL missing.' });
  }
  try {
    const hostname = url.replace(/^https?:\/\//, '').split('/')[0];
    await new Promise((resolve, reject) => {
      dns.lookup(hostname, err => {
        if (err) reject(new Error('DNS lookup failed for ' + hostname));
        else resolve();
      });
    });
    await new Promise((resolve, reject) => {
      https.get(url, resp => {
        if (resp.statusCode >= 200 && resp.statusCode < 400) resolve();
        else reject(new Error('HTTPS request failed with status ' + resp.statusCode));
      }).on('error', err => reject(new Error('HTTPS request error: ' + err.message)));
    });
  } catch (connErr) {
    return res.status(500).json({ error: 'Supabase connectivity check failed: ' + connErr.message });
  }
  try {
    const { data, error } = await supabase.from('restaurants').select('*').limit(1);
    if (error) return res.status(500).json({ error: 'Supabase auth/API error: ' + error.message });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'Supabase fetch failed: ' + (err.message || 'Unknown error') });
  }
});

// --- MENU LOGIC (READ-ONLY, NO SCRAPING/OCR) ---
async function fetchLatestMenuRecord({ restaurantId }) {
  const baseSelect = 'id,restaurant_id,menu_json,source_url,source_type,updated_at';

  const byId = await supabase
    .from('restaurant_menus')
    .select(baseSelect)
    .eq('restaurant_id', restaurantId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (!byId.error && Array.isArray(byId.data) && byId.data.length > 0) {
    return { data: byId.data, error: null };
  }

  if (byId.error) {
    return { data: null, error: byId.error };
  }

  return { data: [], error: null };
}

// Returns the menu source info for a restaurant (Supabase cache, then auto-resolve)
app.get('/api/restaurants/:id/menu-source', async (req, res) => {
  const isValidUUID = (id) => /^[0-9a-fA-F-]{36}$/.test(id);

  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: "Invalid restaurant ID" });
  }

  const restaurantId = req.params.id;

  try {
    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", restaurantId)
      .single();

    if (error) {
      return res.status(500).json({
        error: error.message || 'Supabase error',
        code: error.code || null,
        hint: error.hint || null,
        details: error.details || null
      });
    }

    if (!data) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const menuSource = await resolveMenuSource(data);

    if (!menuSource) {
      return res.status(404).json({ error: "Menu source not found" });
    }

    return res.json({ menuSource });
  } catch (err) {
    console.error('/api/restaurants/:id/menu-source error:', err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

// Returns the full menu for a restaurant
app.get('/api/restaurants/:id/full-menu', async (req, res) => {
  const isValidUUID = (id) => /^[0-9a-fA-F-]{36}$/.test(id);

  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: "Invalid restaurant ID" });
  }

  const restaurantId = req.params.id;

  try {
    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", restaurantId)
      .single();

    if (error) {
      return res.status(500).json({
        error: error.message || 'Supabase error',
        code: error.code || null,
        hint: error.hint || null,
        details: error.details || null
      });
    }

    if (!data) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const menu = await getMenuForRestaurant(data);

    if (!menu) {
      return res.status(404).json({ error: "Menu not found" });
    }

    return res.json({ menu });
  } catch (err) {
    console.error('/api/restaurants/:id/full-menu error:', err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

// Save a confirmed menu into Supabase so we don't need to re-run the AI parser for it
app.post('/api/restaurant/:id/save-menu', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase client not initialized.' });
  const restaurantId = req.params.id;
  const { menu, source_url, source_type, restaurant_name } = req.body || {};
  if (!menu) return res.status(400).json({ error: 'Missing menu JSON in request body.' });
  try {
    const payload = {
      restaurant_id: restaurantId,
      restaurant_name: restaurant_name || decodeURIComponent(restaurantId),
      menu_json: menu,
      source_url: source_url || null,
      source_type: source_type || 'confirmed',
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('restaurant_menus').insert(payload).select().limit(1).single();
    if (error) {
      // If insert fails due to unique constraint, attempt an update to overwrite
      if (error.code && String(error.code).includes('23505')) {
        const { data: up, error: upErr } = await supabase.from('restaurant_menus').update({ menu_json: menu, source_url: source_url || null, source_type: source_type || 'confirmed', updated_at: new Date().toISOString() }).eq('restaurant_id', restaurantId);
        if (upErr) return res.status(500).json({ error: upErr.message || upErr });
        return res.json({ success: true, menu: up });
      }
      return res.status(500).json({ error: error.message || error });
    }
    res.json({ success: true, menu: data });
  } catch (e) {
    console.error('/api/restaurant/:id/save-menu error:', e && e.message ? e.message : e);
    res.status(500).json({ error: 'Failed to save menu.' });
  }
});

// Get list of all available restaurants from local filesystem
app.get('/api/restaurants', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, city, state');

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Handle null values for city and state
    const sanitizedData = data.map(restaurant => ({
      ...restaurant,
      city: restaurant.city || 'Unknown',
      state: restaurant.state || 'Unknown'
    }));

    console.log('Restaurants from DB:', sanitizedData);

    return res.json(sanitizedData);
  } catch (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

function normalizeRestaurantKey(str = '') {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function groupMenuItems(menu) {
  const categoryMap = {};
  for (const item of Array.isArray(menu) ? menu : []) {
    const cat = item?.category || 'Menu';
    if (!categoryMap[cat]) categoryMap[cat] = [];
    categoryMap[cat].push({
      name: item?.name || '',
      description: item?.description || '',
      price: item?.price || ''
    });
  }
  return Object.entries(categoryMap).map(([category, items]) => ({ category, items }));
}

function extractMenuItemsFromHtml(html = '') {
  if (!html) return [];
  const withoutScripts = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  const text = withoutScripts
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\r/g, '\n');

  const lines = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 4 && line.length <= 160);

  const items = [];
  const seen = new Set();
  const pricePattern = /\$?\s?(\d{1,3}(?:\.\d{2})?)/;

  for (const line of lines) {
    const match = line.match(pricePattern);
    if (!match) continue;

    const beforePrice = line.slice(0, match.index).replace(/[-–—:|.]+$/, '').trim();
    const name = beforePrice || line.replace(pricePattern, '').trim();
    const price = `$${match[1]}`;
    if (!name || name.length < 2 || name.length > 90) continue;

    const key = `${name.toLowerCase()}|${price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ name, price, description: '', category: 'Menu' });
  }

  if (items.length >= 5) return items.slice(0, 120);

  const regexFallback = /([A-Z][A-Za-z0-9 '&/()-]{2,90})\s*(?:[-–—:.|]+)?\s*\$([0-9]{1,3}(?:\.[0-9]{2})?)/g;
  let match = null;
  while ((match = regexFallback.exec(text)) !== null) {
    const name = (match[1] || '').trim();
    const price = `$${match[2]}`;
    if (!name) continue;
    const key = `${name.toLowerCase()}|${price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ name, price, description: '', category: 'Menu' });
  }

  return items.slice(0, 120);
}

const TECH_GARBAGE_NAME_REGEX = /(bundle|worker|entrypoint|webpack|nextgen|nextgendash|videoplayer|wamedia|wasm|filehash|mainwebworker|chunk|sourcemap|source map|javascript|manifest)/i;
const NOISE_MENU_NAME_REGEX = /(^view\b.*\bmenu\b|^home$|^about$|^contact$|^menu$|^meta\b|privacy policy|terms of service|all rights reserved|\||©)/i;
const GARBAGE_REACTION_NAMES = new Set([
  'like', 'love', 'selfie', 'dorothy', 'toto', 'haha', 'yay', 'wow', 'confused', 'support', 'sorry', 'anger', 'flame', 'plane'
]);

function isLikelyMenuName(name = '') {
  const clean = String(name || '').replace(/\s+/g, ' ').trim();
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
    const sectionName = section?.section || 'Menu';
    const items = Array.isArray(section?.items) ? section.items : [];
    for (const raw of items) {
      if (typeof raw === 'string') {
        const text = String(raw).replace(/\s+/g, ' ').trim();
        if (!text) continue;
        const priceMatch = text.match(/\$?\s?(\d{1,3}(?:\.\d{2})?)/);
        const name = priceMatch ? text.slice(0, priceMatch.index).trim() : text;
        const price = priceMatch ? `$${priceMatch[1]}` : '';
        if (!isLikelyMenuName(name)) continue;
        flattened.push({ name, price, description: '', category: sectionName });
      } else if (raw && typeof raw === 'object') {
        const name = raw.name || raw.title || raw.dish_name || '';
        const priceText = raw.price || raw.amount || '';
        const priceMatch = String(priceText).match(/(\d{1,3}(?:\.\d{2})?)/);
        const price = priceMatch ? `$${priceMatch[1]}` : '';
        if (!isLikelyMenuName(name)) continue;
        flattened.push({
          name: String(name).trim(),
          price,
          description: String(raw.description || '').trim(),
          category: raw.category || sectionName
        });
      }
    }
  }

  const seen = new Set();
  return flattened.filter((item) => {
    const key = `${String(item.name || '').toLowerCase()}|${String(item.price || '').toLowerCase()}`;
    if (!item.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeMenuItem(raw, fallbackCategory = 'Menu') {
  if (!raw) return null;

  if (typeof raw === 'string') {
    const text = String(raw).replace(/\s+/g, ' ').trim();
    if (!text) return null;
    const priceMatch = text.match(/\$?\s?(\d{1,3}(?:\.\d{2})?)/);
    const name = (priceMatch ? text.slice(0, priceMatch.index) : text).trim();
    const price = priceMatch ? `$${priceMatch[1]}` : '';
    if (!isLikelyMenuName(name)) return null;
    return { name, price, description: '', category: fallbackCategory };
  }

  if (typeof raw !== 'object') return null;
  const name = String(raw.name || raw.title || raw.dish_name || '').replace(/\s+/g, ' ').trim();
  if (!isLikelyMenuName(name)) return null;
  const priceText = String(raw.price || raw.amount || '').trim();
  const priceMatch = priceText.match(/(\d{1,3}(?:\.\d{2})?)/);
  const numericPrice = priceMatch ? Number(priceMatch[1]) : null;
  if (Number.isFinite(numericPrice) && numericPrice > 120) return null;
  const description = String(raw.description || '').replace(/\s+/g, ' ').trim();

  return {
    name,
    price: priceMatch ? `$${priceMatch[1]}` : '',
    description,
    category: raw.category || fallbackCategory
  };
}

function sanitizeMenuItems(items = [], fallbackCategory = 'Menu') {
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

      // Prefer a priced version over an unpriced duplicate of the same dish name.
      if (!existingHasPrice && incomingHasPrice) {
        out[existingIndex] = normalized;
        seenExact.add(exactKey);
        continue;
      }
      if (existingHasPrice && !incomingHasPrice) {
        continue;
      }
    } else {
      firstIndexByName.set(nameKey, out.length);
    }

    seenExact.add(exactKey);
    out.push(normalized);
  }

  return out;
}

function isMenuLikelyCorrupt(rawMenu = [], sanitizedMenu = []) {
  const rawCount = Array.isArray(rawMenu) ? rawMenu.length : 0;
  const cleanCount = Array.isArray(sanitizedMenu) ? sanitizedMenu.length : 0;
  if (rawCount === 0) return false;
  if (cleanCount === 0) return true;

  const cleanRatio = cleanCount / rawCount;
  if (rawCount >= 8 && cleanRatio < 0.4) return true;

  const pricedCount = sanitizedMenu.filter((item) => item && item.price).length;
  if (cleanCount >= 8 && pricedCount === 0) return true;
  return false;
}

const DEFAULT_MIN_SCRAPE_CONFIDENCE = 0.8;
const DEFAULT_MIN_MENU_COMPLETENESS = 0.65;
const DEFAULT_MIN_MENU_ITEMS = 12;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resolveMinScrapeConfidence() {
  const parsed = Number(process.env.MIN_SCRAPE_CONFIDENCE);
  if (!Number.isFinite(parsed)) return DEFAULT_MIN_SCRAPE_CONFIDENCE;
  return clamp(parsed, 0, 1);
}

function resolveMinMenuCompleteness() {
  const parsed = Number(process.env.MIN_MENU_COMPLETENESS);
  if (!Number.isFinite(parsed)) return DEFAULT_MIN_MENU_COMPLETENESS;
  return clamp(parsed, 0, 1);
}

function resolveMinMenuItems() {
  const parsed = Number(process.env.MIN_MENU_ITEMS);
  if (!Number.isFinite(parsed)) return DEFAULT_MIN_MENU_ITEMS;
  return Math.max(1, Math.floor(parsed));
}

function passesScrapeConfidence(score, minScore) {
  return Number.isFinite(score) && Number(score) >= Number(minScore);
}

function allowLegacyMenuCache() {
  return ['1', 'true', 'yes'].includes(String(process.env.ALLOW_LEGACY_MENU_CACHE || '').toLowerCase());
}

async function discoverAndScrapeMenuByName(restaurantName) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const cachePath = path.join(__dirname, '..', 'menu-urls-found.json');
  const normalizedName = normalizeRestaurantKey(restaurantName);

  let discoveredUrl = null;
  let urlConfidence = 0;
  let urlConfidenceReport = null;
  let urlDiscoveryMethod = null;
  const minScrapeConfidence = resolveMinScrapeConfidence();
  const minMenuCompleteness = resolveMinMenuCompleteness();
  const minMenuItems = resolveMinMenuItems();

  try {
    if (fs.existsSync(cachePath)) {
      const cacheRaw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      const cacheCandidates = [restaurantName, normalizedName];
      for (const key of cacheCandidates) {
        const entry = cacheRaw[key];
        if (Array.isArray(entry) && entry[0]?.url) {
          discoveredUrl = entry[0].url;
          urlConfidence = 1;
          urlDiscoveryMethod = 'menu_urls_cache';
          urlConfidenceReport = {
            version: 'url_discovery_confidence_v1',
            method: 'menu_urls_cache',
            confidence: 1,
            tier: 'high',
            reason: 'exact_or_normalized_cache_hit',
            url: discoveredUrl,
            final_url: discoveredUrl
          };
          break;
        }
      }

      if (!discoveredUrl) {
        for (const [key, value] of Object.entries(cacheRaw)) {
          if (normalizeRestaurantKey(key) !== normalizedName) continue;
          if (Array.isArray(value) && value[0]?.url) {
            discoveredUrl = value[0].url;
            urlConfidence = 1;
            urlDiscoveryMethod = 'menu_urls_cache';
            urlConfidenceReport = {
              version: 'url_discovery_confidence_v1',
              method: 'menu_urls_cache',
              confidence: 1,
              tier: 'high',
              reason: 'normalized_cache_hit',
              url: discoveredUrl,
              final_url: discoveredUrl
            };
            break;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Failed reading menu-urls cache:', e.message);
  }

  if (!discoveredUrl) {
    const discovery = await discoverRestaurantURL(restaurantName);
    discoveredUrl = discovery?.url || null;
    urlConfidence = Number(discovery?.confidence || 0);
    urlConfidenceReport = discovery?.confidence_report || null;
    urlDiscoveryMethod = discovery?.method || 'unknown';
  }

  if (!discoveredUrl) {
    return {
      source_url: null,
      items: [],
      needsOCR: false,
      url_confidence: urlConfidence,
      url_confidence_report: urlConfidenceReport,
      url_discovery_method: urlDiscoveryMethod,
      scrape_confidence: 0,
      scrape_confidence_report: null,
      min_scrape_confidence: minScrapeConfidence,
      menu_completeness_score: 0,
      menu_completeness_report: null,
      min_menu_completeness: minMenuCompleteness,
      min_menu_items: minMenuItems
    };
  }

  try {
    const scrapeResult = await scrapeMenuAgent(discoveredUrl);
    const scrapeConfidence = Number(scrapeResult?.confidence || 0);
    const scrapeConfidenceReport = scrapeResult?.confidence_report || null;
    const confidentScrape = passesScrapeConfidence(scrapeConfidence, minScrapeConfidence);
    const scrapedItems = sanitizeMenuItemsShared(flattenScrapedMenuItemsShared(scrapeResult));
    const scrapedMenuCompleteness = buildMenuCompletenessReport({
      items: scrapedItems,
      scrapeConfidence,
      urlConfidence
    });
    const completeScrape = passesMenuCompleteness(
      scrapedMenuCompleteness,
      minMenuCompleteness,
      minMenuItems
    );

    if (confidentScrape && completeScrape) {
      return {
        source_url: discoveredUrl,
        items: scrapedItems,
        needsOCR: false,
        url_confidence: urlConfidence,
        url_confidence_report: urlConfidenceReport,
        url_discovery_method: urlDiscoveryMethod,
        scrape_confidence: scrapeConfidence,
        scrape_confidence_report: scrapeConfidenceReport,
        min_scrape_confidence: minScrapeConfidence,
        menu_completeness_score: Number(scrapedMenuCompleteness?.score || 0),
        menu_completeness_report: scrapedMenuCompleteness,
        min_menu_completeness: minMenuCompleteness,
        min_menu_items: minMenuItems
      };
    }
    if (scrapedItems.length > 0) {
      // Keep partial dynamic scrape; static HTML extraction may add more below.
      const response = await fetch(discoveredUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (response.ok) {
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/pdf')) {
          return {
            source_url: discoveredUrl,
            items: scrapedItems,
            needsOCR: true,
            url_confidence: urlConfidence,
            url_confidence_report: urlConfidenceReport,
            url_discovery_method: urlDiscoveryMethod,
            scrape_confidence: scrapeConfidence,
            scrape_confidence_report: scrapeConfidenceReport,
            min_scrape_confidence: minScrapeConfidence,
            menu_completeness_score: Number(scrapedMenuCompleteness?.score || 0),
            menu_completeness_report: scrapedMenuCompleteness,
            min_menu_completeness: minMenuCompleteness,
            min_menu_items: minMenuItems
          };
        }
        const html = await response.text();
        const htmlItems = extractMenuItemsFromHtml(html);
        const merged = sanitizeMenuItemsShared([...scrapedItems, ...htmlItems]);
        const mergedCompleteness = buildMenuCompletenessReport({
          items: merged,
          scrapeConfidence,
          urlConfidence
        });
        const mergedIsComplete = passesMenuCompleteness(
          mergedCompleteness,
          minMenuCompleteness,
          minMenuItems
        );
        if (merged.length > scrapedItems.length && confidentScrape && mergedIsComplete) {
          return {
            source_url: discoveredUrl,
            items: merged,
            needsOCR: false,
            url_confidence: urlConfidence,
            url_confidence_report: urlConfidenceReport,
            url_discovery_method: urlDiscoveryMethod,
            scrape_confidence: scrapeConfidence,
            scrape_confidence_report: scrapeConfidenceReport,
            min_scrape_confidence: minScrapeConfidence,
            menu_completeness_score: Number(mergedCompleteness?.score || 0),
            menu_completeness_report: mergedCompleteness,
            min_menu_completeness: minMenuCompleteness,
            min_menu_items: minMenuItems
          };
        }
      }
      if (confidentScrape && completeScrape) {
        return {
          source_url: discoveredUrl,
          items: scrapedItems,
          needsOCR: false,
          url_confidence: urlConfidence,
          url_confidence_report: urlConfidenceReport,
          url_discovery_method: urlDiscoveryMethod,
          scrape_confidence: scrapeConfidence,
          scrape_confidence_report: scrapeConfidenceReport,
          min_scrape_confidence: minScrapeConfidence,
          menu_completeness_score: Number(scrapedMenuCompleteness?.score || 0),
          menu_completeness_report: scrapedMenuCompleteness,
          min_menu_completeness: minMenuCompleteness,
          min_menu_items: minMenuItems
        };
      }
    }

    return {
      source_url: discoveredUrl,
      items: [],
      needsOCR: false,
      url_confidence: urlConfidence,
      url_confidence_report: urlConfidenceReport,
      url_discovery_method: urlDiscoveryMethod,
      scrape_confidence: scrapeConfidence,
      scrape_confidence_report: scrapeConfidenceReport,
      min_scrape_confidence: minScrapeConfidence,
      menu_completeness_score: Number(scrapedMenuCompleteness?.score || 0),
      menu_completeness_report: scrapedMenuCompleteness,
      min_menu_completeness: minMenuCompleteness,
      min_menu_items: minMenuItems,
      blocked_by_scrape_confidence: !confidentScrape,
      blocked_by_menu_completeness: confidentScrape && !completeScrape
    };
  } catch (scrapeErr) {
    console.warn('Dynamic scraper failed:', scrapeErr.message);
  }

  try {
    const response = await fetch(discoveredUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return {
        source_url: discoveredUrl,
        items: [],
        needsOCR: false,
        url_confidence: urlConfidence,
        url_confidence_report: urlConfidenceReport,
        url_discovery_method: urlDiscoveryMethod,
        scrape_confidence: 0,
        scrape_confidence_report: null,
        min_scrape_confidence: minScrapeConfidence,
        menu_completeness_score: 0,
        menu_completeness_report: null,
        min_menu_completeness: minMenuCompleteness,
        min_menu_items: minMenuItems
      };
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/pdf')) {
      return {
        source_url: discoveredUrl,
        items: [],
        needsOCR: true,
        url_confidence: urlConfidence,
        url_confidence_report: urlConfidenceReport,
        url_discovery_method: urlDiscoveryMethod,
        scrape_confidence: 0,
        scrape_confidence_report: null,
        min_scrape_confidence: minScrapeConfidence,
        menu_completeness_score: 0,
        menu_completeness_report: null,
        min_menu_completeness: minMenuCompleteness,
        min_menu_items: minMenuItems
      };
    }

    const html = await response.text();
    const items = extractMenuItemsFromHtml(html);
    const fallbackItems = sanitizeMenuItemsShared(items);
    const fallbackScrapeConfidence =
      items.length >= 35 ? 0.82 :
      items.length >= 20 ? 0.78 :
      items.length >= 12 ? 0.7 :
      items.length >= 8 ? 0.62 : 0.45;
    const confidentFallback = passesScrapeConfidence(fallbackScrapeConfidence, minScrapeConfidence);
    const fallbackCompleteness = buildMenuCompletenessReport({
      items: fallbackItems,
      scrapeConfidence: fallbackScrapeConfidence,
      urlConfidence
    });
    const completeFallback = passesMenuCompleteness(
      fallbackCompleteness,
      minMenuCompleteness,
      minMenuItems
    );
    return {
      source_url: discoveredUrl,
      items: confidentFallback && completeFallback ? fallbackItems : [],
      needsOCR: false,
      url_confidence: urlConfidence,
      url_confidence_report: urlConfidenceReport,
      url_discovery_method: urlDiscoveryMethod,
      scrape_confidence: fallbackScrapeConfidence,
      scrape_confidence_report: {
        version: 'menu_scraper_fallback_confidence_v1',
        confidence: fallbackScrapeConfidence,
        tier:
          fallbackScrapeConfidence >= 0.85 ? 'high' :
          fallbackScrapeConfidence >= 0.65 ? 'medium' :
          fallbackScrapeConfidence >= 0.45 ? 'low' : 'very_low',
        metrics: {
          item_count: Array.isArray(items) ? items.length : 0,
          source: 'static_html_fallback'
        }
      },
      min_scrape_confidence: minScrapeConfidence,
      menu_completeness_score: Number(fallbackCompleteness?.score || 0),
      menu_completeness_report: fallbackCompleteness,
      min_menu_completeness: minMenuCompleteness,
      min_menu_items: minMenuItems,
      blocked_by_scrape_confidence: !confidentFallback,
      blocked_by_menu_completeness: confidentFallback && !completeFallback
    };
  } catch (err) {
    console.warn('Discover/scrape fetch failed:', err.message);
    return {
      source_url: discoveredUrl,
      items: [],
      needsOCR: false,
      url_confidence: urlConfidence,
      url_confidence_report: urlConfidenceReport,
      url_discovery_method: urlDiscoveryMethod,
      scrape_confidence: 0,
      scrape_confidence_report: null,
      min_scrape_confidence: minScrapeConfidence,
      menu_completeness_score: 0,
      menu_completeness_report: null,
      min_menu_completeness: minMenuCompleteness,
      min_menu_items: minMenuItems
    };
  }
}

// Get specific restaurant info and menu
app.get('/api/restaurants/:name', async (req, res) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const restaurantsDir = path.join(__dirname, '..', 'backend', 'restaurants');
    
    const requestedName = decodeURIComponent(req.params.name);
    
    // Normalize for matching
    const normalize = (str) => str.toLowerCase().replace(/[\s_'-]+/g, '_');
    const requestedNorm = normalize(requestedName);
    const forceRefresh = ['1', 'true', 'yes'].includes(String(req.query.refresh || '').toLowerCase());
    
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
    const hasCachedMenu = fs.existsSync(menuPath);
    let cachedRawMenu = [];
    let cachedMenu = [];
    let cachedMeta = null;

    try {
      if (fs.existsSync(menuMetaPath)) {
        cachedMeta = JSON.parse(fs.readFileSync(menuMetaPath, 'utf8'));
      }
    } catch (_) {
      cachedMeta = null;
    }

    if (hasCachedMenu) {
      try {
        cachedRawMenu = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
        cachedMenu = sanitizeMenuItemsShared(cachedRawMenu);
      } catch (_) {
        cachedRawMenu = [];
        cachedMenu = [];
      }
    }

    const cachedCorrupt = isMenuLikelyCorrupt(cachedRawMenu, cachedMenu);
    const cachedTooSmall = cachedMenu.length > 0 && cachedMenu.length < 6;
    const minScrapeConfidence = resolveMinScrapeConfidence();
    const minMenuCompleteness = resolveMinMenuCompleteness();
    const minMenuItems = resolveMinMenuItems();
    const legacyCacheAllowed = allowLegacyMenuCache();
    const cachedScrapeConfidence = Number(cachedMeta?.scrape_confidence);
    const cachedMissingScrapeConfidence = !Number.isFinite(cachedScrapeConfidence);
    const cachedBelowScrapeThreshold =
      (cachedMissingScrapeConfidence && !legacyCacheAllowed) ||
      (Number.isFinite(cachedScrapeConfidence) && cachedScrapeConfidence < minScrapeConfidence);
    const cachedMenuCompletenessReport = buildMenuCompletenessReport({
      items: cachedMenu,
      scrapeConfidence: Number.isFinite(cachedScrapeConfidence) ? cachedScrapeConfidence : null,
      urlConfidence: Number(cachedMeta?.url_confidence || 0)
    });
    const cachedBelowMenuCompleteness = !passesMenuCompleteness(
      cachedMenuCompletenessReport,
      minMenuCompleteness,
      minMenuItems
    );

    if (forceRefresh || !hasCachedMenu || cachedCorrupt || cachedTooSmall || cachedBelowScrapeThreshold || cachedBelowMenuCompleteness) {
      const discovered = await discoverAndScrapeMenuByName(requestedName);
      const discoveredItems = sanitizeMenuItemsShared(discovered.items || []);
      if (discovered.needsOCR) {
        return res.status(202).json({
          name: requestedName,
          id: requestedNorm,
          itemCount: 0,
          categories: [],
          menu: [],
          source_url: discovered.source_url,
          url_confidence: discovered.url_confidence,
          url_confidence_report: discovered.url_confidence_report,
          url_discovery_method: discovered.url_discovery_method,
          scrape_confidence: discovered.scrape_confidence,
          scrape_confidence_report: discovered.scrape_confidence_report,
          menu_completeness_score: Number(discovered.menu_completeness_score || 0),
          menu_completeness_report: discovered.menu_completeness_report || null,
          min_menu_completeness: Number(discovered.min_menu_completeness || minMenuCompleteness),
          min_menu_items: Number(discovered.min_menu_items || minMenuItems),
          needsOCR: true,
          error: 'Discovered menu is a PDF/image and needs OCR.'
        });
      }

      if (!discoveredItems.length) {
        if (discovered.blocked_by_scrape_confidence || discovered.blocked_by_menu_completeness) {
          const rejectionReason = discovered.blocked_by_menu_completeness
            ? `menu completeness ${Number(discovered.menu_completeness_score || 0).toFixed(2)} is below minimum ${Number(discovered.min_menu_completeness || minMenuCompleteness).toFixed(2)} (min items ${Number(discovered.min_menu_items || minMenuItems)})`
            : `confidence ${Number(discovered.scrape_confidence || 0).toFixed(2)} is below minimum ${Number(discovered.min_scrape_confidence || 0.8).toFixed(2)}`;
          return res.status(422).json({
            error: `Scraped menu rejected: ${rejectionReason}`,
            source_url: discovered.source_url || null,
            url_confidence: discovered.url_confidence || 0,
            url_confidence_report: discovered.url_confidence_report || null,
            url_discovery_method: discovered.url_discovery_method || null,
            scrape_confidence: discovered.scrape_confidence || 0,
            scrape_confidence_report: discovered.scrape_confidence_report || null,
            min_scrape_confidence: discovered.min_scrape_confidence || 0.8,
            menu_completeness_score: Number(discovered.menu_completeness_score || 0),
            menu_completeness_report: discovered.menu_completeness_report || null,
            min_menu_completeness: Number(discovered.min_menu_completeness || minMenuCompleteness),
            min_menu_items: Number(discovered.min_menu_items || minMenuItems),
            blocked_by_scrape_confidence: Boolean(discovered.blocked_by_scrape_confidence),
            blocked_by_menu_completeness: Boolean(discovered.blocked_by_menu_completeness)
          });
        }
        if ((cachedBelowScrapeThreshold || cachedBelowMenuCompleteness) && !legacyCacheAllowed) {
          const confidenceReason =
            cachedBelowScrapeThreshold
              ? `confidence ${Number.isFinite(cachedScrapeConfidence) ? cachedScrapeConfidence.toFixed(2) : 'unknown'} is below minimum ${Number(minScrapeConfidence || 0.8).toFixed(2)}`
              : null;
          const completenessReason =
            cachedBelowMenuCompleteness
              ? `completeness ${Number(cachedMenuCompletenessReport?.score || 0).toFixed(2)} is below minimum ${Number(minMenuCompleteness || 0.65).toFixed(2)}`
              : null;
          const rejectionReason = [confidenceReason, completenessReason].filter(Boolean).join(' and ');
          return res.status(422).json({
            error: `Cached menu rejected: ${rejectionReason}`,
            source_url: discovered.source_url || null,
            url_confidence: discovered.url_confidence || 0,
            url_confidence_report: discovered.url_confidence_report || null,
            url_discovery_method: discovered.url_discovery_method || null,
            scrape_confidence: Number.isFinite(cachedScrapeConfidence) ? cachedScrapeConfidence : 0,
            scrape_confidence_report: discovered.scrape_confidence_report || null,
            min_scrape_confidence: minScrapeConfidence,
            menu_completeness_score: Number(cachedMenuCompletenessReport?.score || 0),
            menu_completeness_report: cachedMenuCompletenessReport,
            min_menu_completeness: minMenuCompleteness,
            min_menu_items: minMenuItems,
            blocked_by_scrape_confidence: Boolean(cachedBelowScrapeThreshold),
            blocked_by_menu_completeness: Boolean(cachedBelowMenuCompleteness),
            needs_refresh: true
          });
        }
        if (!hasCachedMenu) {
          return res.status(404).json({ error: 'Restaurant not found' });
        }
      } else {
        try {
          fs.mkdirSync(actualDir, { recursive: true });
          fs.writeFileSync(menuPath, JSON.stringify(discoveredItems, null, 2), 'utf8');
          const metaPayload = {
            source_url: discovered.source_url || null,
            url_confidence: Number(discovered.url_confidence || 0),
            url_discovery_method: discovered.url_discovery_method || null,
            scrape_confidence: Number(discovered.scrape_confidence || 0),
            min_scrape_confidence: Number(discovered.min_scrape_confidence || minScrapeConfidence),
            menu_completeness_score: Number(discovered.menu_completeness_score || 0),
            menu_completeness_report: discovered.menu_completeness_report || null,
            min_menu_completeness: Number(discovered.min_menu_completeness || minMenuCompleteness),
            min_menu_items: Number(discovered.min_menu_items || minMenuItems),
            updated_at: new Date().toISOString()
          };
          fs.writeFileSync(menuMetaPath, JSON.stringify(metaPayload, null, 2), 'utf8');
        } catch (writeErr) {
          console.warn('Unable to cache discovered menu file:', writeErr.message);
        }

        const categories = groupMenuItems(discoveredItems);
        return res.json({
          name: requestedName,
          id: path.basename(actualDir),
          itemCount: discoveredItems.length,
          categories,
          menu: discoveredItems,
          source_url: discovered.source_url,
          url_confidence: discovered.url_confidence,
          url_confidence_report: discovered.url_confidence_report,
          url_discovery_method: discovered.url_discovery_method,
          scrape_confidence: discovered.scrape_confidence,
          scrape_confidence_report: discovered.scrape_confidence_report,
          menu_completeness_score: Number(discovered.menu_completeness_score || 0),
          menu_completeness_report: discovered.menu_completeness_report || null,
          min_menu_completeness: Number(discovered.min_menu_completeness || minMenuCompleteness),
          min_menu_items: Number(discovered.min_menu_items || minMenuItems),
          discovered: true,
          refreshed: forceRefresh
        });
      }
    }

    let menu = cachedMenu;
    if (!menu.length && hasCachedMenu) {
      try {
        const fallbackRaw = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
        menu = sanitizeMenuItemsShared(fallbackRaw);
      } catch (_) {
        menu = [];
      }
    }

    if (!menu.length) {
      return res.status(404).json({
        error: 'Menu not found for this restaurant yet. Try refresh=1 after URL discovery finishes.'
      });
    }

    // Keep local cache clean by rewriting sanitized data when needed.
    if (hasCachedMenu && Array.isArray(cachedRawMenu) && menu.length !== cachedRawMenu.length) {
      try {
        fs.writeFileSync(menuPath, JSON.stringify(menu, null, 2), 'utf8');
      } catch (writeErr) {
        console.warn('Unable to rewrite sanitized cached menu:', writeErr.message);
      }
    }

    const categories = groupMenuItems(menu);
    const finalMenuCompletenessReport = buildMenuCompletenessReport({
      items: menu,
      scrapeConfidence: Number.isFinite(cachedScrapeConfidence) ? cachedScrapeConfidence : null,
      urlConfidence: Number(cachedMeta?.url_confidence || 0)
    });
    
    res.json({
      name: path.basename(actualDir).replace(/_/g, ' '),
      id: path.basename(actualDir),
      itemCount: menu.length,
      categories,
      menu,
      scrape_confidence: Number.isFinite(cachedScrapeConfidence) ? cachedScrapeConfidence : null,
      min_scrape_confidence: minScrapeConfidence,
      menu_completeness_score: Number(finalMenuCompletenessReport?.score || 0),
      menu_completeness_report: finalMenuCompletenessReport,
      min_menu_completeness: minMenuCompleteness,
      min_menu_items: minMenuItems
    });
  } catch (err) {
    console.error('/api/restaurants/:name error:', err.message);
    res.status(500).json({ error: 'Failed to fetch restaurant' });
  }
});


if (SENTRY_ENABLED) {
  app.use(Sentry.Handlers.errorHandler());
}

const PORT = process.env.PORT || 8081;
const HOST = '0.0.0.0';
console.log(`Server is attempting to start on port: ${PORT}`);
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`TasteTrails backend server running on http://${HOST}:${PORT} (all interfaces)`);
});
