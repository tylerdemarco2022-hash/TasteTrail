import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../../backend/supabase.js';

// Use require for menuScraperAgent since it's CommonJS
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const menuScraperAgent = require('../../../agents/menuScraperAgent');

const router = express.Router();

// POST /api/scrape-menu { url, restaurant_id, restaurant_name }
router.post('/', async (req, res) => {
  const { url, restaurant_id, restaurant_name } = req.body;
  if (!url || !restaurant_id || !restaurant_name) {
    return res.status(400).json({ error: 'url, restaurant_id, and restaurant_name are required' });
  }
  try {
    // Scrape the menu from the URL
    const result = await menuScraperAgent({ name: restaurant_name, website: url });
    const menuSections = result.menu_sections || [];
    // Flatten items for DB
    const items = menuSections.flatMap(section =>
      (section.items || []).map(item => ({
        ...item,
        section: section.section || null
      }))
    );
    // Save each item to Supabase (menu_items table)
    for (const item of items) {
      await supabase.from('menu_items').upsert({
        restaurant_id,
        name: item.name,
        description: item.description || '',
        price: item.price,
        section: item.section || null
      }, { onConflict: ['restaurant_id', 'name'] });
    }
    res.json({ success: true, menu: items });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to scrape menu' });
  }
});

export default router;
