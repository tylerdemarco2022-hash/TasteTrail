import { Anthropic } from "@anthropic-ai/sdk";

const client = new Anthropic();

/**
 * Parses raw menu text using Claude AI
 * Converts unstructured text into clean JSON with categories, items, and prices
 * @param {string} rawMenuText - Raw menu text to parse
 * @param {string} restaurantName - Name of restaurant for context
 * @param {string} location - Location of restaurant for context
 * @returns {Promise<{success: boolean, categories: Array, rawText: string, error?: string}>}
 */
export async function parseMenuWithAI(rawMenuText, restaurantName, location) {
  if (!rawMenuText || rawMenuText.trim().length === 0) {
    return {
      success: false,
      categories: [],
      rawText: "",
      error: "Empty menu text provided"
    };
  }

  try {
    const systemPrompt = `You are a restaurant menu parser. Your job is to extract menu items from raw text and structure them into clean JSON.

Guidelines:
1. Identify meal categories (Appetizers, Entrees, Desserts, Beverages, etc.)
2. Extract item names and prices
3. Keep descriptions short if present
4. Prices should be numbers only (remove $ and commas)
5. Group items logically by category
6. Handle multiple formats: "Item Name $12.99", "Item Name - $12.99", "Item Name......$12.99"

Return valid JSON with this structure:
{
  "categories": [
    {
      "category": "Category Name",
      "items": [
        {
          "name": "Item Name",
          "price": 12.99,
          "description": "Optional description"
        }
      ]
    }
  ]
}`;

    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `Parse this menu text from ${restaurantName} in ${location}:\n\n${rawMenuText}`
        }
      ],
      system: systemPrompt
    });

    // Extract JSON from response
    let jsonText = message.content[0].type === "text" ? message.content[0].text : "";

    // Try to extract JSON from response (might be wrapped in markdown code blocks)
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || jsonText.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonText);

    // Validate and clean the parsed data
    const cleanedCategories = (parsed.categories || []).map((cat) => ({
      category: String(cat.category || "Uncategorized").trim(),
      items: (cat.items || []).map((item) => ({
        name: String(item.name || "Unknown Item").trim(),
        price: typeof item.price === "number" ? item.price : parseFloat(item.price) || 0,
        description: item.description ? String(item.description).trim() : undefined
      }))
    }));

    // Filter out empty categories
    const validCategories = cleanedCategories.filter((cat) => cat.items.length > 0);

    return {
      success: true,
      categories: validCategories,
      rawText: rawMenuText.substring(0, 500), // Store first 500 chars of raw text
      itemCount: validCategories.reduce((sum, cat) => sum + cat.items.length, 0)
    };
  } catch (error) {
    console.error("Menu parsing error:", error);
    return {
      success: false,
      categories: [],
      rawText: rawMenuText.substring(0, 500),
      error: `Failed to parse menu: ${error.message}`
    };
  }
}

/**
 * Cleans and validates menu JSON structure
 * @param {Object} menuData - Menu data to validate
 * @returns {Object} - Cleaned menu data
 */
export function validateMenuStructure(menuData) {
  if (!menuData || typeof menuData !== "object") {
    return { categories: [] };
  }

  const categories = Array.isArray(menuData.categories) ? menuData.categories : [];

  return {
    categories: categories
      .map((cat) => ({
        category: String(cat.category || "Uncategorized").trim(),
        items: Array.isArray(cat.items)
          ? cat.items.map((item) => ({
              name: String(item.name || "Unknown").trim(),
              price: typeof item.price === "number" ? item.price : 0,
              description: item.description ? String(item.description).trim() : undefined
            }))
          : []
      }))
      .filter((cat) => cat.items.length > 0)
  };
}

/**
 * Enriches menu data with AI-generated descriptions
 * @param {Object} menuData - Menu data with items
 * @param {string} restaurantName - Restaurant name for context
 * @returns {Promise<Object>} - Menu with descriptions
 */
export async function enrichMenuWithDescriptions(menuData, restaurantName) {
  if (!menuData.categories || menuData.categories.length === 0) {
    return menuData;
  }

  try {
    // Get items that don't have descriptions
    const itemsNeedingDescriptions = [];
    menuData.categories.forEach((cat, catIdx) => {
      cat.items.forEach((item, itemIdx) => {
        if (!item.description) {
          itemsNeedingDescriptions.push({
            catIdx,
            itemIdx,
            name: item.name,
            price: item.price
          });
        }
      });
    });

    if (itemsNeedingDescriptions.length === 0) {
      return menuData;
    }

    // Get descriptions from Claude
    const itemList = itemsNeedingDescriptions.map((item) => `${item.name} ($${item.price})`).join("\n");

    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `For this ${restaurantName} menu, provide 1-sentence descriptions for each item:\n\n${itemList}\n\nReturn as JSON: {"items": [{"name": "Item", "description": "Description"}]}`
        }
      ]
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = responseText.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      const descriptions = JSON.parse(jsonMatch[1]);
      if (descriptions.items && Array.isArray(descriptions.items)) {
        descriptions.items.forEach((desc) => {
          const item = itemsNeedingDescriptions.find(
            (i) => i.name.toLowerCase() === desc.name.toLowerCase()
          );
          if (item) {
            menuData.categories[item.catIdx].items[item.itemIdx].description = desc.description;
          }
        });
      }
    }
  } catch (error) {
    console.warn("Failed to enrich descriptions:", error);
  }

  return menuData;
}
