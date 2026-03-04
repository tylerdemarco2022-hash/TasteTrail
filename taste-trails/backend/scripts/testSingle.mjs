import { scrapeMenu } from "../scraper/menuScraperAgent.js";

console.log("Starting single test...");
try {
  const result = await scrapeMenu("https://www.example.com");
  console.log("Success! Got items:", result.item_count);
  console.log("Debug metrics:", result.debug_metrics);
} catch (error) {
  console.error("Full error object:", error);
  console.error("Error message:", error?.message);
  console.error("Error stack:", error?.stack);
}
