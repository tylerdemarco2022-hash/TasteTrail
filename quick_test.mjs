import menuScraperAgent from './agents/menuScraperAgent.js';

console.log(" Starting quick test...");

try {
  await menuScraperAgent({
    name: "Culinary Dropout",
    website: "https:// www.culinarydropout.com/locations-menus/",
    menuUrl: "https://www.culinarydropout.com/locations-menus/"
  });
  console.log("✓ Test completed successfully");
} catch (err) {
  console.error("✗ Test failed:", err.message);
  console.error(err.stack);
}
