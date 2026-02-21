import express from 'express';
import { guessMenuUrl } from '../services/menuUrlGuesser.js';
import { supabase as supabaseClient } from '../supabase.js';
const supabase = supabaseClient;

const router = express.Router();

// Mock restaurant DB with real UUIDs
const restaurants = {
  'c1a2b3d4-e5f6-7890-abcd-131mainuuid': { restaurantId: 'c1a2b3d4-e5f6-7890-abcd-131mainuuid', name: '131 Main', menuUrl: null },
  'd2b3c4a5-f6e7-8901-bcda-angelinesuuid': { restaurantId: 'd2b3c4a5-f6e7-8901-bcda-angelinesuuid', name: "Angeline's", menuUrl: null },
};

async function menuScraperAgent(restaurant) {
  // Replace with real scraper logic
  return [
    {
      name: 'Dinner',
      items: [
        { name: 'Steak', description: 'Grilled steak', price: '$25' },
        { name: 'Salad', description: 'Fresh greens', price: '$10' },
      ],
    },
  ];
}

router.get('/restaurants/:restaurantId/full-menu', async (req, res) => {
  try {
    console.log("Full-menu route hit with ID:", req.params.restaurantId);
    const { restaurantId } = req.params;
    // Supabase query for real restaurant
    const { data: restaurant, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single();
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }
    console.log("Restaurant fetched from DB:", restaurant);
    if (!restaurant) {
      console.error('Restaurant not found for ID:', restaurantId);
      return res.status(404).json({ error: "Restaurant not found" });
    }
    // Send restaurant name to URL finder
    let menuUrl;
    try {
      console.log("URL finder input:", restaurant.name);
      menuUrl = await guessMenuUrl(restaurant.name);
      if (!menuUrl) {
        console.error('Menu URL not found for:', restaurant.name);
      }
      restaurant.menu_url = menuUrl;
      console.log("menuUrl from guessMenuUrl:", menuUrl);
    } catch (urlErr) {
      console.error('URL finder error:', urlErr);
    }
    // Scrape menu using restaurant name and menuUrl
    let scrapedMenu;
    try {
      scrapedMenu = await menuScraperAgent({ name: restaurant.name, menuUrl });
      if (!scrapedMenu || !scrapedMenu.menu_sections) {
        console.error('Menu scrape failed for:', restaurant.name);
      }
      console.log("scraper output:", scrapedMenu);
    } catch (scrapeErr) {
      console.error('Menu scraper error:', scrapeErr);
    }
    const sections = scrapedMenu && scrapedMenu.menu_sections
      ? scrapedMenu.menu_sections.map(section => ({
          name: section.name,
          items: section.items.map(item => ({
            name: item.name,
            description: item.description,
            price: item.price
          }))
        }))
      : [];
    const finalJson = {
      restaurantId: restaurant.id,
      name: restaurant.name,
      sections
    };
    console.log("Final normalized JSON:", finalJson);
    res.status(200).json(finalJson);
  } catch (err) {
    console.error("Full-menu route error:", err);
    res.status(500).json({ error: err.message || "Menu fetch failed" });
  }
});

export default router;
