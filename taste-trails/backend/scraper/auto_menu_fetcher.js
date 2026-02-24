import fetch from "node-fetch";

/**
 * Attempts to find the menu URL for a restaurant by name.
 * @param {string} name - Restaurant name
 * @returns {Promise<string|null>} - Working menu URL or null
 */
export async function findRestaurantMenuURL(name) {
  // Manual override for known restaurants
  const manualOverrides = {
    "131 main": "https://131main.com/menu/",
    "131main": "https://131main.com/menu/",
    "chick-fil-a": "https://www.chick-fil-a.com/menu",
    "chickfila": "https://www.chick-fil-a.com/menu"
  };
  const lowerName = name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  for (const key in manualOverrides) {
    if (lowerName === key.replace(/[^a-z0-9]/g, "")) {
      console.log("MANUAL OVERRIDE FOUND:", manualOverrides[key]);
      return manualOverrides[key];
    }
  }

  // Normalize name: lowercase, remove spaces/apostrophes
  let normalized = lowerName.replace(/['’]/g, "").replace(/\s+/g, "");

  // If name starts with numbers, try hyphen pattern
  let hyphenPattern = normalized.replace(/^(\d+)([a-z]+)/, "$1-$2");

  // Build candidate domains
  const candidates = [
    `https://${normalized}.com`,
    `https://www.${normalized}.com`,
    `https://${hyphenPattern}.com`,
    `https://www.${hyphenPattern}.com`,
    `https://${normalized}.net`,
    `https://www.${normalized}.net`,
    `https://${normalized}.org`,
    `https://www.${normalized}.org`,
    `https://${normalized}/menu`,
    `https://www.${normalized}/menu`,
    `https://${hyphenPattern}/menu`,
    `https://www.${hyphenPattern}/menu`
  ];

  // Remove duplicates
  const uniqueCandidates = [...new Set(candidates)];

  // Log candidates
  console.log("URL CANDIDATES:", uniqueCandidates);

  // Try each candidate with HEAD request
  for (const url of uniqueCandidates) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      console.log("HEAD ATTEMPT:", url, "STATUS:", res.status);
      if (res.status === 200) {
        console.log("WORKING URL FOUND:", url);
        return url;
      }
    } catch (err) {
      console.log("HEAD ERROR:", url, err);
    }
  }

  return null;
}
