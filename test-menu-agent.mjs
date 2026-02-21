// Multi-restaurant menu extraction test using prioritized fallback agent
// Usage: node test-menu-agent.mjs

import { scrapeMenu } from './agents/menuScraperAgent.js';

const restaurants = [
  {
    name: 'Fig Tree',
    website: 'https://www.thefigtreerestaurant.com/menu/'
  },
  {
    name: "Al Mike's Tavern",
    website: 'https://www.almikestavern.com/menu/'
  },
  {
    name: 'The Cowfish',
    website: 'https://www.thecowfish.com/menu/'
  },
  {
    name: 'Culinary Dropout',
    website: 'https://www.culinarydropout.com/menu/'
  }
];

console.log('USING_MENU_SCRAPER_AGENT: true');

for (const restaurant of restaurants) {
  console.log(`\n=== Testing: ${restaurant.name} ===`);
  try {
    const result = await scrapeMenu(restaurant.website, restaurant.name);
    const sections = result.menu_sections || [];
    let totalItems = 0;
    let primaryCount = 0;
    let modifierCount = 0;
    sections.forEach(sec => {
      totalItems += sec.items.length;
      sec.items.forEach(item => {
        if (item.name && item.price !== undefined && item.price !== null) primaryCount++;
        if (item.modifiers && item.modifiers.length) modifierCount += item.modifiers.length;
      });
    });
    console.log('TOTAL_SECTIONS:', sections.length);
    console.log('TOTAL_ITEMS:', totalItems);
    console.log('PRIMARY_ITEM_COUNT:', primaryCount);
    console.log('MODIFIER_COUNT:', modifierCount);
    console.log('FINAL_CONFIDENCE_RECALCULATED:', result.confidence);
    console.log('FINAL_STRATEGY_SELECTED:', result.restaurant);
    console.log('MENU:', JSON.stringify(sections, null, 2));
  } catch (err) {
    console.log('Extraction error:', err.message || err);
  }
}
