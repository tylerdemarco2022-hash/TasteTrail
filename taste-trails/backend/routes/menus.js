// In-memory scrape timestamps for rate limiting
const scrapeTimestamps = {};
import express from 'express'
import { requireAuth } from './auth.js'
import { readJSON, writeJSON } from '../utils/localDB.js'
import { discoverRestaurantURL } from '../services/urlDiscovery.js'
import { scrapeMenu } from '../services/menuScraper.js'

const router = express.Router()
const MIN_MENU_SCRAPE_CONFIDENCE = (() => {
  const parsed = Number(process.env.MIN_SCRAPE_CONFIDENCE)
  if (!Number.isFinite(parsed)) return 0.8
  return Math.max(0, Math.min(1, parsed))
})()

router.post('/scrape', requireAuth, async (req, res) => {
  const { url } = req.body

  if (!url) {
    return res.status(400).json({ error: 'Missing url' })
  }

  try {
    const result = await scrapeMenu(url)
    const score = Number(result?.confidence || 0)
    if (!Number.isFinite(score) || score < MIN_MENU_SCRAPE_CONFIDENCE) {
      return res.status(422).json({
        error: `Scraped menu rejected: confidence ${score.toFixed(2)} is below minimum ${MIN_MENU_SCRAPE_CONFIDENCE.toFixed(2)}`,
        confidence: score,
        min_scrape_confidence: MIN_MENU_SCRAPE_CONFIDENCE
      })
    }

    const menus = readJSON('menus.json')

    const entry = {
      id: Date.now(),
      url,
      ...result,
      lastUpdated: Date.now()
    }

    menus.push(entry)
    writeJSON('menus.json', menus)

    return res.json(result)
  } catch (err) {
    return res.status(500).json({ error: 'Scrape failed' })
  }
})

router.post('/discover-and-scrape', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Missing name' });
  }

  function normalizeName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  const restaurants = readJSON('restaurants.json');
  const menus = readJSON('menus.json');
  const normalizedName = normalizeName(name);

  // Check for existing restaurant by normalized name
  let restaurant = restaurants.find(r => normalizeName(r.name) === normalizedName);
  let discoveredUrl = null;
  let urlConfidence = 0;

  if (restaurant && restaurant.url) {
    discoveredUrl = restaurant.url;
    urlConfidence = 1;
  } else {
    // Discover URL if not found
    const discovery = await discoverRestaurantURL(name);
    discoveredUrl = discovery.url;
    urlConfidence = discovery.confidence;
    if (discoveredUrl) {
      // Create restaurant entry if missing
      if (!restaurant) {
        restaurant = {
          id: Date.now(),
          name,
          url: discoveredUrl,
          createdBy: req.user ? req.user.id : 'system'
        };
        restaurants.push(restaurant);
        writeJSON('restaurants.json', restaurants);
      } else {
        // Update url if missing
        if (!restaurant.url) {
          restaurant.url = discoveredUrl;
          writeJSON('restaurants.json', restaurants);
        }
      }
    }
  }

  if (!discoveredUrl) {
    return res.status(404).json({ error: 'URL not found' });
  }

  // Check for valid menu cache
  const now = Date.now();
  const sixHours = 6 * 60 * 60 * 1000;
  const cached = menus.find(entry => entry.url === discoveredUrl && (now - entry.lastUpdated) < sixHours);
  if (cached) {
    return res.json({
      discoveredUrl,
      urlConfidence,
      menu_sections: cached.menu_sections,
      cached: true
    });
  }

  // Scrape if no valid cache
  const result = await scrapeMenu(discoveredUrl);
  const scrapeConfidence = Number(result?.confidence || 0);
  if (!Number.isFinite(scrapeConfidence) || scrapeConfidence < MIN_MENU_SCRAPE_CONFIDENCE) {
    return res.status(422).json({
      discoveredUrl,
      urlConfidence,
      error: `Scraped menu rejected: confidence ${scrapeConfidence.toFixed(2)} is below minimum ${MIN_MENU_SCRAPE_CONFIDENCE.toFixed(2)}`,
      confidence: scrapeConfidence,
      min_scrape_confidence: MIN_MENU_SCRAPE_CONFIDENCE
    });
  }
  const entry = {
    id: Date.now(),
    restaurantName: name,
    url: discoveredUrl,
    menu_sections: result.menu_sections,
    confidence: result.confidence,
    lastUpdated: now
  };
  menus.push(entry);
  writeJSON('menus.json', menus);

  return res.json({
    discoveredUrl,
    urlConfidence,
    ...result
  });
});

export default router
