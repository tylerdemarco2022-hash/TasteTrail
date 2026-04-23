process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:');
  console.error(err);
  console.error('STACK:', err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:');
  console.error(reason);
  process.exit(1);
});
import 'dotenv/config';

console.log("ADMIN_TOKEN FROM ENV:", process.env.ADMIN_TOKEN);
console.log("⏰ [STARTUP] Backend process started at:", new Date().toISOString());
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
import discoveryRoutes from './routes/discovery.js';
import adminRestaurantsRoutes from './routes/adminRestaurants.js';
import adminConfigRoutes from './routes/adminConfig.js';
import adminUsersRoutes from './routes/adminUsers.js';
import adminMenuItemsRoutes from './routes/adminMenuItems.js';
import adminDiscoveryRoutes from '../backend/discovery/adminDiscoveryRoutes.js';
import topDishesRoutes from './routes/topDishes.js';
import { startScheduler } from '../backend/discovery/scheduler.js';
import { resolveMenuSource } from './menu_source_resolver.js';
import { discoverRestaurantURL } from '../backend/services/urlDiscovery.js';
import { scrapeMenu as scrapeMenuAgent } from '../backend/scraper/menuScraperAgent.js';
import { addScrapeJob } from './workers/queueSetup.js';
import {
  buildMenuCompletenessReport,
  passesMenuCompleteness,
  sanitizeMenuItems as sanitizeMenuItemsShared,
  flattenScrapedMenuItems as flattenScrapedMenuItemsShared
} from '../backend/services/menuQuality.js';
import path from 'path';

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
  console.error('\n');
  console.error('===== UNCAUGHT EXCEPTION =====');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  console.error('==============================\n');
  if (SENTRY_ENABLED) {
    Sentry.captureException(err);
  }
});
process.on('unhandledRejection', err => {
  console.error('\n');
  console.error('===== UNHANDLED REJECTION =====');
  console.error('Rejected Value:', err);
  if (err && typeof err === 'object' && err.stack) {
    console.error('Stack:', err.stack);
  }
  console.error('================================\n');
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
app.use('/api', topDishesRoutes);
app.use('/api', moderationRoutes);
app.use('/api', discoveryRoutes);
app.use('/admin/discovery', adminDiscoveryRoutes);
app.use('/admin/restaurants', adminRestaurantsRoutes);
app.use('/admin/config', adminConfigRoutes);
app.use('/admin/users', adminUsersRoutes);
app.use('/admin/menu-items', adminMenuItemsRoutes);
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

// Restaurant images endpoint
app.get('/api/restaurant-images', (req, res) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const imagePath = path.join(__dirname, '../backend/data/restaurant-images.json');
    
    if (fs.existsSync(imagePath)) {
      console.log('[DEBUG-CACHE] Skipping restaurant-images.json parsing (TEMPORARILY DISABLED)');
      res.json({ success: true, data: [] });
    } else {
      res.json({ success: false, error: 'Restaurant images not found', data: [] });
    }
  } catch (error) {
    console.error('Error loading restaurant images:', error);
    res.status(500).json({ success: false, error: error.message, data: [] });
  }
});

// Get single restaurant image
app.get('/api/restaurant-images/:id', (req, res) => {
  try {
    console.log('[DEBUG-CACHE] Skipping restaurant-images.json parsing (TEMPORARILY DISABLED)');
    res.status(404).json({ success: false, error: 'Image not found' });
  } catch (error) {
    console.error('Error loading restaurant image:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Removed heartbeat log - was flooding console
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

// Unified search endpoint: users, restaurants
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ users: [], restaurants: [], cities: [] });

  // Search local users
  let users = [];
  try {
    const { readJSON } = await import('../backend/utils/localDB.js');
    const allUsers = readJSON('users.json') || [];
    users = allUsers
      .filter(u => {
        const name = (u.name || '').toLowerCase();
        const code = (u.user_code || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        return name.includes(q) || code.includes(q) || email.includes(q);
      })
      .map(u => ({
        id: u.id,
        name: u.name,
        userCode: u.user_code,
        avatar_url: u.avatar_url || null,
      }))
      .slice(0, 10);
  } catch (e) {
    console.error('[search] user lookup error:', e.message);
  }

  // Search restaurants from Supabase
  let restaurants = [];
  try {
    if (supabase) {
      const { data } = await supabase
        .from('restaurants')
        .select('id,name,location,image_url,avg_rating,review_count')
        .ilike('name', `%${q}%`)
        .limit(8);
      if (data) {
        restaurants = data.map(r => ({
          id: r.id,
          name: r.name,
          location: r.location || '',
          image: r.image_url || null,
          rating: r.avg_rating || 0,
          reviewCount: r.review_count || 0,
        }));
      }
    }
  } catch (e) {
    console.error('[search] restaurant lookup error:', e.message);
  }

  return res.json({ users, restaurants, cities: [] });
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

// Returns the full menu for a restaurant from Supabase menu_items
app.get('/api/restaurants/:id/full-menu', async (req, res) => {
  const isValidUUID = (id) => /^[0-9a-fA-F-]{36}$/.test(id);

  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: "Invalid restaurant ID" });
  }

  const restaurantId = req.params.id;

  try {
    // Get restaurant info
    const { data: restaurant, error: restErr } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("id", restaurantId)
      .single();

    if (restErr || !restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Try menu_items table first (individual items with ratings)
    const { data: menuItems, error: itemsErr } = await supabase
      .from('menu_items')
      .select('id, name, description, price, photo_url, rating_weighted, rating_bayesian, rating_count, emoji_tags')
      .eq('restaurant_id', restaurantId);

    if (!itemsErr && menuItems && menuItems.length > 0) {
      console.log(`✅ [FullMenu] Found ${menuItems.length} items in menu_items for "${restaurant.name}"`);
      return res.json({
        menu: menuItems,
        name: restaurant.name,
        itemCount: menuItems.length,
        source: 'database'
      });
    }

    // Fallback: try restaurant_menus table (full JSON blob)
    const { data: savedMenu } = await supabase
      .from('restaurant_menus')
      .select('menu_json, source_url, updated_at')
      .eq('restaurant_id', restaurantId)
      .limit(1)
      .single();

    if (savedMenu?.menu_json) {
      const items = Array.isArray(savedMenu.menu_json) ? savedMenu.menu_json : [];
      console.log(`✅ [FullMenu] Found ${items.length} items in restaurant_menus for "${restaurant.name}"`);
      return res.json({
        menu: items,
        name: restaurant.name,
        itemCount: items.length,
        source: 'restaurant_menus'
      });
    }

    return res.status(404).json({ error: "Menu not found for this restaurant" });
  } catch (err) {
    console.error('/api/restaurants/:id/full-menu error:', err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

// NOTE: POST /api/save-menu and POST /api/restaurant/:id/save-menu removed.
// Menu persistence is server-owned only — handled inside GET /api/restaurants/:name.

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
    const cat = item?.section_name || item?.category || 'Menu';
    if (!categoryMap[cat]) categoryMap[cat] = [];
    categoryMap[cat].push({
      id: item?.id || null,
      name: item?.name || '',
      description: item?.description || '',
      price: item?.price || '',
      photo_url: item?.photo_url || null,
      category: item?.category || cat,
      section_name: item?.section_name || cat,
      restaurant_id: item?.restaurant_id || null,
      menu_type: item?.menu_type || null
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

function sanitizeString(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/\\(?!["\\/bfnrtu])/g, '')
    .replace(/\u0000/g, '')
    .trim();
}

/**
 * Save scraped menu items to Supabase menu_items table so we don't re-scrape.
 * Finds or creates the restaurant, then upserts each menu item.
 */
async function saveMenuItemsToDb(restaurantName, menuItems, sourceUrl, { isFreshScrape = false } = {}) {
  console.log('[DEBUG] Saving menu for:', restaurantName);
  console.log('[DEBUG] Items received:', Array.isArray(menuItems) ? menuItems.length : 0);
  if (!supabase || !menuItems || menuItems.length === 0) {
    console.log('[DEBUG] No menu items to save for:', restaurantName);
    return;
  }

  const cleanedItems = menuItems.map((item) => ({
    ...item,
    name: sanitizeString(item?.name),
    description: sanitizeString(item?.description),
    category: sanitizeString(item?.category),
    price: sanitizeString(item?.price)
  }));

  try {
    // Find or create restaurant
    let restaurantId = null;
    const { data: existing } = await supabase
      .from('restaurants')
      .select('id')
      .ilike('name', restaurantName)
      .limit(1);

    if (existing && existing.length > 0) {
      restaurantId = existing[0].id;
    } else {
      const { data: created, error: createErr } = await supabase
        .from('restaurants')
        .insert([{ name: restaurantName }])
        .select();
      if (!createErr && created?.[0]) {
        restaurantId = created[0].id;
      }
    }

    if (!restaurantId) {
      console.log('[SCRAPE_SAVE_FAIL] Could not resolve restaurant ID for "%s"', restaurantName);
      return;
    }
    console.log('[DEBUG] Restaurant ID used for save:', restaurantId);

    // Normalize, deduplicate, and validate before insert
    const seenNames = new Set();
    const rows = [];
    for (const item of cleanedItems) {
      const rawName = sanitizeString(item.name || item.dish || '')?.trim();
      if (!rawName) continue;

      const dedupKey = rawName.toLowerCase();
      if (seenNames.has(dedupKey)) continue;
      seenNames.add(dedupKey);

      // Validate and parse price
      const rawPrice = item.price ? String(item.price).replace(/[^0-9.]/g, '') : '';
      const parsedPrice = parseFloat(rawPrice);
      const price = (Number.isFinite(parsedPrice) && parsedPrice > 0 && parsedPrice < 10000) ? parsedPrice : null;

      // EXPLICIT section_name persistence (never rely on DB default)
      const sectionName = item.category?.trim() || 'Uncategorized';
      if (!item.category?.trim()) {
        console.warn(
          `⚠️ Backend Persistence Warning [${restaurantName}]: ` +
          `Missing category for item \"${rawName}\", defaulting to Uncategorized`
        );
      }

      rows.push({
        restaurant_id: restaurantId,
        name: rawName,
        description: sanitizeString(item.description || '')?.trim() || null,
        price,
        photo_url: item.photo_url || item.image || item.image_url || null,
        section_name: sectionName
      });
    }

    console.log('[DEBUG] Upsert payload length:', rows.length);
    if (rows.length > 0) {
      console.log('[DEBUG] First item payload sample:', rows[0]);
    }

    if (rows.length === 0) return;

    // Check which items already exist for this restaurant
    const { data: existingItems } = await supabase
      .from('menu_items')
      .select('id, name')
      .eq('restaurant_id', restaurantId);

    const existingNames = new Set((existingItems || []).map(i => i.name.trim().toLowerCase()));
    const newRows = rows.filter(r => !existingNames.has(r.name.toLowerCase()));

    if (newRows.length > 0) {
      let insertResult;
      try {
        insertResult = await supabase
          .from('menu_items')
          .insert(newRows)
          .select('id');
      } catch (err) {
        console.log('Insert failed. Sample item:', newRows[0]);
        console.error(err);
        throw err;
      }
      console.log('Insert result:', insertResult);
      const insertErr = insertResult?.error;

      const { data: verifyItems, error: verifyError } = await supabase
        .from('menu_items')
        .select('id')
        .eq('restaurant_id', restaurantId);
      console.log('[DEBUG] Post-insert verification count:', verifyItems?.length);
      console.log('[DEBUG] Post-insert verification error:', verifyError);

      if (insertErr) {
        console.log('[SCRAPE_SAVE_FAIL] menu_items insert error for "%s": %s', restaurantName, insertErr.message);
      } else {
        console.log('[SCRAPE_SAVE_SUCCESS] Saved %d new menu items for "%s" (%d already existed)', newRows.length, restaurantName, existingNames.size);
        
        // SERVER-SIDE INTEGRITY ASSERTION: Check for excessive uncategorized items
        const totalItems = rows.length;
        const uncategorizedCount = rows.filter(r => r.section_name === 'Uncategorized').length;
        const uncategorizedPercent = (uncategorizedCount / totalItems) * 100;
        
        if (uncategorizedPercent > 20) {
          console.error(
            `🚨 ERROR: Menu Integrity Violation [${restaurantName}]: ` +
            `${uncategorizedCount}/${totalItems} items (${uncategorizedPercent.toFixed(1)}%) are Uncategorized (threshold: 20%). ` +
            `Scraper quality is unacceptable!`
          );
        }
      }
    } else {
      console.log('[DB_HIT] All %d items already in DB for "%s"', rows.length, restaurantName);
    }

    // Upsert into restaurant_menus with versioning and staleness tracking
    const now = new Date().toISOString();
    const upsertPayload = {
      restaurant_id: restaurantId,
      restaurant_name: restaurantName,
      menu_json: cleanedItems,
      source_url: sourceUrl || null,
      source_type: 'scraped',
      item_count: rows.length,
      updated_at: now
    };

    if (isFreshScrape) {
      upsertPayload.last_scraped_at = now;
    }

    // Check current version for bump logic
    const { data: existingMenu } = await supabase
      .from('restaurant_menus')
      .select('menu_version, item_count')
      .eq('restaurant_id', restaurantId)
      .limit(1)
      .single();

    if (existingMenu) {
      const prevCount = existingMenu.item_count || 0;
      const prevVersion = existingMenu.menu_version || 1;
      upsertPayload.menu_version = (rows.length !== prevCount) ? prevVersion + 1 : prevVersion;
    } else {
      upsertPayload.menu_version = 1;
    }

    const { error: menuSaveErr } = await supabase
      .from('restaurant_menus')
      .upsert(upsertPayload, { onConflict: 'restaurant_id' });

    if (menuSaveErr) {
      console.log('[SCRAPE_SAVE_FAIL] restaurant_menus save error for "%s": %s', restaurantName, menuSaveErr.message);
    }
  } catch (err) {
    console.log('[SCRAPE_SAVE_FAIL] Exception saving menu for "%s": %s', restaurantName, err.message);
  }
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
      console.log('[DEBUG-CACHE] Skipping menu-urls-found.json parsing (TEMPORARILY DISABLED)');
      // cacheRaw temporarily disabled
      const cacheRaw = {};
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

const DB_FIRST_THRESHOLD = 8;

// Get specific restaurant info and menu — DB-FIRST with local-file fallback
app.get('/api/restaurants/:name', async (req, res) => {
  try {
    const requestedName = decodeURIComponent(req.params.name);

    // Helper: try to read local menu.json for this restaurant name
    function readLocalMenu(displayName) {
      try {
        const dirName = displayName.replace(/\s+/g, '_');
        const localPath = path.join(__dirname, '../backend/restaurants', dirName, 'menu.json');
        if (fs.existsSync(localPath)) {
          const raw = fs.readFileSync(localPath, 'utf8');
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : null;
        }
      } catch (_) {}
      return null;
    }

    // ─── STEP 1: Find restaurant in DB ───
    const { data: dbRestaurant } = await supabase
      .from('restaurants')
      .select('id, name, menu_status')
      .ilike('name', requestedName)
      .limit(1);

    if (!dbRestaurant || dbRestaurant.length === 0) {
      // Check local file before creating a new DB entry
      const localItems = readLocalMenu(requestedName);
      if (localItems && localItems.length > 0) {
        const categories = groupMenuItems(localItems);
        return res.json({
          name: requestedName,
          itemCount: localItems.length,
          categories,
          menu: localItems,
          source: 'local-cache'
        });
      }

      // Not in DB and no local file — create entry and enqueue scrape
      const { data: newRest, error: createErr } = await supabase
        .from('restaurants')
        .insert([{ name: requestedName }])
        .select('id, name')
        .single();

      if (createErr || !newRest) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }

      try {
        await addScrapeJob({ restaurantId: newRest.id, restaurantName: requestedName, jobType: 'initial_scrape' });
      } catch (_) {}

      return res.json({
        name: requestedName,
        id: newRest.id,
        itemCount: 0,
        categories: [],
        menu: [],
        menuPending: true,
        source: 'enqueued'
      });
    }

    const dbRestId = dbRestaurant[0].id;
    const restaurantName = dbRestaurant[0].name;
    const menuStatus = dbRestaurant[0].menu_status;

    // ─── STEP 1b: Check for image-based menu ───
    if (menuStatus === 'image_menu') {
      return res.json({
        name: restaurantName,
        id: dbRestId,
        itemCount: 0,
        categories: [],
        menu: [],
        menuUnavailable: true,
        reason: 'Image-based menu'
      });
    }

    // ─── STEP 2: Query menu items from DB ───
    const { data: existingItems, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', dbRestId);

    const items = existingItems || [];

    // ─── STEP 3: If we have enough items, check quality then return ───
    if (items.length >= DB_FIRST_THRESHOLD) {
      // Quality gate: if >75% of items are uncategorized, prefer local file
      const uncategorized = items.filter(i => !i.category && (!i.section_name || i.section_name === 'Uncategorized')).length;
      const poorQuality = uncategorized / items.length > 0.75;
      if (!poorQuality) {
        const categories = groupMenuItems(items);
        return res.json({
          name: restaurantName,
          id: dbRestId,
          itemCount: items.length,
          categories,
          menu: items,
          source: 'database'
        });
      }
      console.log(`[DB_FIRST] DB data for "${restaurantName}" is poor quality (${uncategorized}/${items.length} uncategorized), checking local file`);
    }

    // ─── STEP 4: Not enough items in DB (or poor quality) — check local file first ───
    const localItems = readLocalMenu(restaurantName);
    if (localItems && localItems.length > 0) {
      const categories = groupMenuItems(localItems);
      return res.json({
        name: restaurantName,
        id: dbRestId,
        itemCount: localItems.length,
        categories,
        menu: localItems,
        source: 'local-cache'
      });
    }

    // ─── STEP 5: No local file — enqueue background scrape ───
    const alreadyScraping = menuStatus === 'in_progress';
    if (!alreadyScraping) {
      try {
        await addScrapeJob({
          restaurantId: dbRestId,
          restaurantName,
          jobType: items.length === 0 ? 'initial_scrape' : 'low_confidence_retry'
        });
        console.log(`[DB_FIRST] Enqueued scrape for "${restaurantName}" (${items.length} items in DB)`);
      } catch (enqueueErr) {
        console.error(`[DB_FIRST] Failed to enqueue scrape for "${restaurantName}":`, enqueueErr.message);
      }
    }

    // Return whatever we have + menuPending flag
    const categories = groupMenuItems(items);
    return res.json({
      name: restaurantName,
      id: dbRestId,
      itemCount: items.length,
      categories,
      menu: items,
      menuPending: true,
      source: items.length > 0 ? 'database_partial' : 'enqueued'
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
  
  // Start discovery scheduler (every 6 hours)
  const scheduleInterval = process.env.DISCOVERY_SCHEDULE || '0 */6 * * *';
  const tilesPerRun = parseInt(process.env.DISCOVERY_TILES_PER_RUN) || 5;
  startScheduler(supabase, scheduleInterval, tilesPerRun);
});
