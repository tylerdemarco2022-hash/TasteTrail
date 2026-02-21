import express from 'express';
import { guessMenuUrl } from '../services/menuUrlGuesser.js';
// import menuScraperAgent from '../agents/menuScraperAgent.js'; // Uncomment if exists

const router = express.Router();

// Mock restaurant DB
const restaurants = {
  '131-main': { restaurantId: '131-main', name: '131 Main', menuUrl: null },
  'angelines': { restaurantId: 'angelines', name: "Angeline's", menuUrl: null },
};

// Mock menuScraperAgent
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

router.get('/menu/:restaurantId', async (req, res) => {
  try {
    console.log("Route hit for restaurantId:", req.params.restaurantId);
    const { restaurantId } = req.params;
    const restaurant = restaurants[restaurantId];
    if (!restaurant) {
      console.log("Restaurant not found");
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    // Find menu URL if missing
    if (!restaurant.menuUrl) {
      restaurant.menuUrl = await guessMenuUrl(restaurant.name);
      console.log("Menu URL:", restaurant.menuUrl);
    }
    // Scrape menu
    const scraperResult = await menuScraperAgent(restaurant);
    console.log("Scraper output:", scraperResult);
    const finalJson = {
      restaurantId: restaurant.restaurantId,
      name: restaurant.name,
      sections: Array.isArray(scraperResult) ? scraperResult : [],
    };
    console.log("Final JSON:", finalJson);
    res.json(finalJson);
  } catch (err) {
    console.error("Menu route error:", err);
    res.status(500).json({ error: err.message || 'Menu fetch failed' });
  }
});

export default router;
