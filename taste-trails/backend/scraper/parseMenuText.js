/**
 * Extracts menu items from raw text using regex patterns and heuristics
 * Designed to work as fallback when AI parser not available
 * @param {string} text - Raw menu text
 * @param {string} restaurantName - Restaurant name for logging
 * @returns {Object} - Structured menu data
 */
export function parseMenuText(text, restaurantName = "Unknown") {
  if (!text || text.trim().length === 0) {
    return { categories: [] };
  }

  // Clean up text
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ""); // Remove control characters
  const lines = text.split(/\n+/).map((line) => line.trim()).filter((line) => line.length > 0);

  const categories = [];
  let currentCategory = null;
  const categoryKeywords = ["appetizer", "starter", "entree", "main", "side", "dessert", "beverage", "drink", "cocktail", "wine", "beer", "salad", "soup", "special", "burger", "sandwich", "pizza"];

  // Detect potential categories
  const categoryLines = new Map();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Check if line is likely a category header
    const isCategory = categoryKeywords.some((kw) => lowerLine.includes(kw) && line.length < 50);

    if (isCategory && !lowerLine.includes("$")) {
      currentCategory = line;
      categoryLines.set(i, { type: "category", name: currentCategory });
    } else if (currentCategory && line.length > 0) {
      categoryLines.set(i, { type: "item", category: currentCategory, line });
    }
  }

  // Parse items with prices
  const categoryMap = {};

  for (const [idx, entry] of categoryLines.entries()) {
    if (entry.type === "category") {
      const catName = entry.name;
      if (!categoryMap[catName]) {
        categoryMap[catName] = [];
      }
    } else if (entry.type === "item") {
      const itemLine = entry.line;

      // Try to extract price from line
      const priceMatch = itemLine.match(/\$\s*(\d+\.?\d*)/);
      const price = priceMatch ? parseFloat(priceMatch[1]) : null;

      if (price !== null) {
        // Remove price from line to get item name
        const itemName = itemLine.replace(/\s*\$\s*\d+\.?\d*.*$/, "").trim();

        if (itemName.length > 2) {
          categoryMap[entry.category].push({
            name: itemName,
            price: price,
            description: ""
          });
        }
      } else {
        // No price found, still might be an item
        if (itemLine.length > 3 && !itemLine.match(/^[0-9]+\./)) {
          categoryMap[entry.category].push({
            name: itemLine,
            price: null,
            description: ""
          });
        }
      }
    }
  }

  // Convert to category array
  for (const [catName, items] of Object.entries(categoryMap)) {
    if (items.length > 0) {
      categories.push({
        category: catName,
        items: items.filter((item) => item.name.length > 0)
      });
    }
  }

  return { categories };
}

/**
 * Alternative parsing strategy for poorly formatted menus
 * Uses more aggressive pattern matching
 * @param {string} text - Raw menu text
 * @returns {Object} - Structured menu data
 */
export function parseMenuTextAggressive(text) {
  if (!text || text.trim().length === 0) {
    return { categories: [] };
  }

  const items = [];
  const lines = text.split(/\n+/).map((line) => line.trim()).filter((line) => line.length > 0);

  for (const line of lines) {
    // Match patterns like "Item Name $12.99" or "Item - $12.99"
    const match = line.match(/^([^$]*?)\s*[\-\.]?\s*\$\s*(\d+\.?\d*)/);

    if (match) {
      const name = match[1].trim();
      const price = parseFloat(match[2]);

      if (name.length > 2 && name.length < 100) {
        items.push({
          category: "Menu",
          name: name,
          price: price,
          description: ""
        });
      }
    }
  }

  if (items.length === 0) {
    return { categories: [] };
  }

  return {
    categories: [
      {
        category: "Menu",
        items: items
      }
    ]
  };
}

/**
 * Merges multiple parse results, preferring items with prices
 * @param {...Object} results - Parse results to merge
 * @returns {Object} - Merged menu data
 */
export function mergeParseResults(...results) {
  const allCategories = {};

  for (const result of results) {
    if (result && result.categories) {
      for (const cat of result.categories) {
        if (!allCategories[cat.category]) {
          allCategories[cat.category] = [];
        }

        for (const item of cat.items) {
          // Check if item already exists
          const exists = allCategories[cat.category].some(
            (i) => i.name.toLowerCase() === item.name.toLowerCase()
          );

          if (!exists) {
            allCategories[cat.category].push(item);
          }
        }
      }
    }
  }

  const categories = Object.entries(allCategories)
    .map(([name, items]) => ({
      category: name,
      items: items.filter((item) => item.name && item.name.length > 0)
    }))
    .filter((cat) => cat.items.length > 0);

  return { categories };
}
