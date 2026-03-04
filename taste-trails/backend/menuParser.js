import { Anthropic } from "@anthropic-ai/sdk";
import { safeJsonParse } from './utils/safeJsonParse.js';

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

CRITICAL RULES:
1. USE THE EXACT SECTION HEADERS from the menu (e.g., "Raw", "Small Plates", "From The Grill", "Mains")
2. DO NOT create generic categories like "Appetizers" or "Entrees" unless those are the actual headers
3. Preserve the original casing and spelling of section headers
4. Extract item names and prices accurately
5. Keep descriptions if present
6. Prices should be numbers only (remove $ and commas)
7. If no section header is visible, use "Uncategorized" ONLY as last resort

Return valid JSON with this structure:
{
  "categories": [
    {
      "category": "Exact Section Header From Menu",
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

    let parsed;
    console.log('[JSONPARSE] Length:', jsonText.length);
    console.log('[JSONPARSE] First 300 chars:', jsonText.slice(0, 300));
    if (jsonText.length > 2800) {
      console.log('[JSONPARSE] Chars 2700-2800:', jsonText.slice(2700, 2800));
    }
    console.log('[JSONPARSE] Raw string:', jsonText);
    function sanitizeAiJson(text) {
      if (!text || typeof text !== "string") return text;
      // Remove control characters
      text = text.replace(/[\u0000-\u001F\u007F]/g, "");
      // Escape single backslashes that are not valid JSON escapes
      text = text.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
      return text;
    }

    const cleaned = sanitizeAiJson(jsonText);
    if (cleaned.length !== jsonText.length) {
      console.log('[SANITIZE] Modified AI JSON string length:', jsonText.length, '→', cleaned.length);
    }
    try {
      parsed = safeJsonParse('menuParser:AIResponse', cleaned);
    } catch (err) {
      const dumpPath = `/tmp/json_file_failure_${Date.now()}.txt`;
      require('fs').writeFileSync(dumpPath, cleaned, { encoding: 'utf8' });
      console.log('[JSONPARSE] Invalid JSON payload detected. Error:', err.message);
      throw err;
    }

    // Validate and clean the parsed data with proper warnings
    const cleanedCategories = (parsed.categories || []).map((cat) => {
      const rawCategory = cat.category
      const trimmedCategory = String(rawCategory || "").trim()
      
      // Log warning if category is missing or empty
      if (!trimmedCategory || trimmedCategory === "Uncategorized") {
        console.warn(
          `⚠️ Menu Parser Warning [${restaurantName}]: ` +
          `Category missing or defaulted to "Uncategorized" for ${cat.items?.length || 0} items`
        )
      }
      
      return {
        category: trimmedCategory || "Uncategorized", // Always trim, preserve casing
        items: (cat.items || []).map((item) => {
          const itemName = String(item.name || "Unknown Item").trim()
          
          // Log warning if item name is problematic
          if (!itemName || itemName === "Unknown Item") {
            console.warn(
              `⚠️ Menu Parser Warning [${restaurantName}]: ` +
              `Invalid item name in category "${trimmedCategory}"`
            )
          }
          
          return {
            name: itemName,
            price: typeof item.price === "number" ? item.price : parseFloat(item.price) || 0,
            description: item.description ? String(item.description).trim() : undefined
          }
        })
      }
    })

    // Filter out empty categories
    const validCategories = cleanedCategories.filter((cat) => cat.items.length > 0);

    // ORPHAN SECTION DETECTION: Log warnings for sections with no items
    cleanedCategories.forEach((cat) => {
      if (cat.items.length === 0) {
        console.warn(
          `⚠️ Orphan Section Detected [${restaurantName}]: ` +
          `Section header "${cat.category}" has no items following it`
        );
      }
    });

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
 * CRITICAL: Always trim category, preserve casing, log warnings
 * @param {Object} menuData - Menu data to validate
 * @param {string} restaurantName - Restaurant name for logging
 * @returns {Object} - Cleaned menu data
 */
export function validateMenuStructure(menuData, restaurantName = 'Unknown') {
  if (!menuData || typeof menuData !== "object") {
    return { categories: [] };
  }

  const categories = Array.isArray(menuData.categories) ? menuData.categories : [];

  return {
    categories: categories
      .map((cat) => {
        const rawCategory = cat.category
        const trimmedCategory = String(rawCategory || "").trim()
        
        // BACKEND VALIDATION: Log warning if category is missing
        if (!trimmedCategory) {
          console.warn(
            `⚠️ Backend Validation Warning [${restaurantName}]: ` +
            `Empty category detected, defaulting to "Uncategorized" for ${cat.items?.length || 0} items`
          )
        }
        
        return {
          category: trimmedCategory || "Uncategorized", // Always trim, preserve casing, default at persistence layer
          items: Array.isArray(cat.items)
            ? cat.items.map((item) => {
                const itemName = String(item.name || "").trim()
                
                // Log warning for items with missing names
                if (!itemName) {
                  console.warn(
                    `⚠️ Backend Validation Warning [${restaurantName}]: ` +
                    `Item with empty name in category "${trimmedCategory}"`
                  )
                }
                
                return {
                  name: itemName || "Unknown",
                  price: typeof item.price === "number" ? item.price : 0,
                  description: item.description ? String(item.description).trim() : undefined
                }
              })
            : []
        }
      })
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
      try {
        const descriptions = safeJsonParse('menuParser:descriptionMatch', jsonMatch[1]);
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
      } catch (err) {
        console.log("Invalid JSON payload detected.");
        console.log("First 500 chars:", jsonMatch[1].slice(0, 500));
      }
    }
  } catch (error) {
    console.warn("Failed to enrich descriptions:", error);
  }

  return menuData;
}
