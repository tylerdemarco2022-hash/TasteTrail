import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (one level up)
dotenv.config({
  path: path.resolve(__dirname, '../.env')
});

console.log('ENV FILE PATH:', path.resolve(__dirname, '../.env'));
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_KEY PREVIEW: ',
  process.env.SUPABASE_SERVICE_ROLE_KEY
    ? process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 8)
    : 'undefined'
);

console.log('GOOGLE_API_KEY:',
  process.env.GOOGLE_API_KEY
    ? process.env.GOOGLE_API_KEY.slice(0, 6)
    : 'undefined'
);

console.log('GOOGLE_CSE_ID:',
  process.env.GOOGLE_CSE_ID
    ? process.env.GOOGLE_CSE_ID.slice(0, 6)
    : 'undefined'
);

console.log("🔥 OFFICIAL TASTETRAILS BACKEND STARTED");
import { supabase } from '../backend/supabase.js';
import express from 'express';
import cors from 'cors';
import menuRoutes from '../backend/server/routes/menu.js';
import nearbyRoutes from '../backend/server/routes/nearby.js';
import followRequestsRoutes from '../backend/server/routes/followRequests.js';
import authRoutes from './routes/auth.js';
import { resolveMenuSource } from './menu_source_resolver.js';

// Load environment variables from .env file
// dotenv.config({ path: './.env' });

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

// If OPENAI_API_KEY is not set in this server's .env, try loading from workspace root .env
try {
  const hasKey = !!process.env.OPENAI_API_KEY && !String(process.env.OPENAI_API_KEY).includes('your-openai');
  if (!hasKey) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const rootEnv = path.join(__dirname, '../../.env');
    if (fs.existsSync(rootEnv)) {
      const envText = fs.readFileSync(rootEnv, 'utf8');
      const m = envText.match(/OPENAI_API_KEY\s*=\s*(.+)/);
      if (m && m[1]) {
        process.env.OPENAI_API_KEY = m[1].trim().replace(/^\s*\"|\"\s*$/g, '').replace(/^\'|\'$/g, '');
        console.log('Loaded OPENAI_API_KEY from workspace root .env');
      }
    }
  }
} catch (e) {
  console.warn('Could not load OPENAI_API_KEY from root .env:', e && e.message);
}

console.log("SUPABASE URL:", process.env.SUPABASE_URL);
console.log(
  "SUPABASE_SERVICE_ROLE_KEY:",
  process.env.SUPABASE_SERVICE_ROLE_KEY
    ? process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 6) + "..." +
      process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-4)
    : "MISSING"
);
console.log("SERVICE KEY EXISTS:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("ENV CHECK END");

console.log('GOOGLE_API_KEY:',
  process.env.GOOGLE_API_KEY
    ? process.env.GOOGLE_API_KEY.slice(0,6)
    : 'undefined'
);

console.log('GOOGLE_CSE_ID:',
  process.env.GOOGLE_CSE_ID
    ? process.env.GOOGLE_CSE_ID.slice(0,6)
    : 'undefined'
);

process.on('exit', code => console.error('[EXIT EVENT]', code));
process.on('beforeExit', code => console.error('[BEFORE EXIT]', code));
process.on('uncaughtException', err => console.error('[UNCAUGHT]', err));
process.on('unhandledRejection', err => console.error('[UNHANDLED]', err));

// Use resilient supabase client from backend wrapper (may be a no-op client when env missing)
// const supabase = supabaseClient;


const app = express();
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
app.use((req, res, next) => {
  console.log("INCOMING REQUEST:", req.method, req.path);
  next();
});
// Register menu API routes
app.use('/api', menuRoutes);
app.use('/api', nearbyRoutes);
app.use('/api', followRequestsRoutes);
console.log("REGISTERING /auth ROUTES");
app.use("/auth", authRoutes);

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
  const key = process.env.OPENAI_API_KEY || null;
  res.json({ hasKey: !!key, keyPreview: key ? (String(key).slice(0, 12) + '...' + String(key).slice(-4)) : null });
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
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(400).json({ error: 'No OPENAI key in server process.' });
    const resp = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
    const status = resp.status;
    const body = await resp.json().catch(() => null);
    return res.json({ status, sampleModel: body && body.data && body.data[0] && body.data[0].id ? body.data[0].id : null });
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
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
  try {
    const { data, error } = await supabase.from('users').select('*').limit(1);
    if (error) {
      console.error("Supabase test query error:", error.message);
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: "Supabase connection is working", data });
  } catch (err) {
    console.error("Unexpected error in Supabase test endpoint:", err.message);
    res.status(500).json({ error: "Internal server error" });
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
    
    if (!fs.existsSync(menuPath)) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    const menu = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
    
    // Organize items by category
    const categoryMap = {};
    
    if (Array.isArray(menu)) {
      menu.forEach(item => {
        const cat = item.category || 'Other';
        if (!categoryMap[cat]) {
          categoryMap[cat] = [];
        }
        categoryMap[cat].push({
          name: item.name,
          description: item.description || '',
          price: item.price || ''
        });
      });
    }
    
    const categories = Object.entries(categoryMap).map(([category, items]) => ({
      category,
      items
    }));
    
    res.json({
      name: path.basename(actualDir).replace(/_/g, ' '),
      id: path.basename(actualDir),
      itemCount: menu.length,
      categories,
      menu
    });
  } catch (err) {
    console.error('/api/restaurants/:name error:', err.message);
    res.status(500).json({ error: 'Failed to fetch restaurant' });
  }
});

// Add search route directly in index.js
app.get('/api/search', async (req, res) => {
  const { q } = req.query;

  console.log("SEARCH ROUTE HIT");

  console.log("Query parameter q:", q);

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, avatar_url')
      .ilike('username', `%${q}%`)
      .limit(20);

    if (error) {
      console.error("Supabase query error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log("Supabase query result:", data);
    res.json(data);
  } catch (err) {
    console.error("Unexpected error in /api/search:", err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get("/", (req, res) => {
  res.json({ status: "TasteTrails backend running" });
});

const PORT = process.env.PORT || 3000;

console.log("Attempting to start server...");

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

console.log('Server setup complete. Attempting to start listening on port:', PORT);

// Log an error if environment variables are not loaded
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are not loaded.');
  process.exit(1);
}
