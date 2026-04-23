import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, '../data/adminConfig.json');

const DEFAULT_ALGO = {
  ratingWeight: 70,
  recencyWeight: 20,
  popularityWeight: 10,
  trendingBoost: true,
  newDishBoost: true,
  bayesianSmoothing: true,
  personalizedFeed: false,
};

const DEFAULT_MONO = {
  featuredEnabled: false,
  boostEnabled: false,
  sponsoredBadge: false,
  adPlacements: false,
  featuredRestaurants: [],
  boostedDishes: [],
};

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

function writeConfig(data) {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

// Export for use in other routes (e.g. topDishes)
export function getAlgorithmConfig() {
  return { ...DEFAULT_ALGO, ...(readConfig().algorithm || {}) };
}

export function getMonetizationConfig() {
  return { ...DEFAULT_MONO, ...(readConfig().monetization || {}) };
}

// ── Admin token middleware ───────────────────────────────────────────────────
const checkAdminToken = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  const expected = process.env.ADMIN_TOKEN || 'dev-token-change-me';
  if (token !== expected) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// GET /admin/config/algorithm
router.get('/algorithm', checkAdminToken, (req, res) => {
  res.json(getAlgorithmConfig());
});

// POST /admin/config/algorithm
router.post('/algorithm', checkAdminToken, (req, res) => {
  const cfg = readConfig();
  cfg.algorithm = { ...DEFAULT_ALGO, ...req.body };
  writeConfig(cfg);
  console.log('[Admin] Algorithm config updated:', cfg.algorithm);
  res.json({ success: true, algorithm: cfg.algorithm });
});

// GET /admin/config/monetization
router.get('/monetization', checkAdminToken, (req, res) => {
  res.json(getMonetizationConfig());
});

// POST /admin/config/monetization
router.post('/monetization', checkAdminToken, (req, res) => {
  const cfg = readConfig();
  cfg.monetization = { ...DEFAULT_MONO, ...req.body };
  writeConfig(cfg);
  console.log('[Admin] Monetization config updated');
  res.json({ success: true, monetization: cfg.monetization });
});

export default router;
