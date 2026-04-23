// server/utils/classifyRestaurant.js

const SERVICE_KEYWORDS = {
  fast_casual: [
    { words: ["counter", "order at counter"], score: 2 },
  ],
  casual_dining: [
    { words: ["waiter", "full service", "table service"], score: 2 },
  ],
  fine_dining: [
    { words: ["tasting menu", "sommelier", "white tablecloth"], score: 3 },
  ],
  bar_grill: [
    { words: ["sports bar", "TVs", "draft beer"], score: 2 },
  ],
};

const CUISINE_KEYWORDS = {
  steakhouse: ["ribeye", "filet", "strip", "porterhouse", "dry-aged"],
  seafood: ["oyster", "lobster", "crab", "shrimp", "scallop", "mussel"],
  sushi: ["nigiri", "sashimi", "maki", "roll", "tuna", "salmon"],
};

function classifyRestaurant({ name, description = '', menuItems = [] }) {
  // Service Model Scoring
  const service_scores = { fast_casual: 0, casual_dining: 0, fine_dining: 0, bar_grill: 0 };
  const desc = (description || '').toLowerCase();
  for (const [model, rules] of Object.entries(SERVICE_KEYWORDS)) {
    for (const rule of rules) {
      for (const word of rule.words) {
        if (desc.includes(word)) service_scores[model] += rule.score;
      }
    }
  }
  // Find highest scoring service model
  let maxScore = Math.max(...Object.values(service_scores));
  let topModels = Object.entries(service_scores).filter(([_, v]) => v === maxScore && v > 0).map(([k]) => k);
  let service_model = topModels.length === 1 ? topModels[0] : 'casual_dining';

  // Cuisine Tag Detection
  const cuisine_scores = { steakhouse: 0, seafood: 0, sushi: 0 };
  const allMenuText = menuItems.map(m => `${m.name || ''} ${m.description || ''}`.toLowerCase());
  for (const [tag, keywords] of Object.entries(CUISINE_KEYWORDS)) {
    for (const text of allMenuText) {
      for (const word of keywords) {
        // For sushi, require 'raw' context for tuna/salmon
        if (tag === 'sushi' && ["tuna", "salmon"].includes(word)) {
          if (text.includes(word) && text.includes('raw')) cuisine_scores[tag]++;
        } else if (text.includes(word)) {
          cuisine_scores[tag]++;
        }
      }
    }
  }
  // If ≥50% menu items contain seafood keywords, auto-include seafood
  if (menuItems.length > 0) {
    const seafoodHits = allMenuText.filter(text => CUISINE_KEYWORDS.seafood.some(word => text.includes(word))).length;
    if (seafoodHits / menuItems.length >= 0.5) cuisine_scores.seafood = menuItems.length;
  }
  const cuisine_tags = Object.entries(cuisine_scores).filter(([_, v]) => v > 0).map(([k]) => k);

  // Logging
  console.log('CLASSIFICATION_RESULT', {
    service_model,
    cuisine_tags,
    service_scores,
    cuisine_scores,
  });

  return { service_model, cuisine_tags, service_scores, cuisine_scores };
}

module.exports = { classifyRestaurant };
