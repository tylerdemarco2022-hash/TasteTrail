import menuScraperAgent from '../../agents/menuScraperAgent.js';
import * as agentModule from '../../agents/menuScraperAgent.js';

console.log("AGENT_MODULE_OBJECT:", agentModule);
console.log("AGENT_MODULE_KEYS:", Object.keys(agentModule));
console.log("DEFAULT_EXPORT_VALUE:", agentModule.default);
console.log("TYPE_OF_DEFAULT:", typeof agentModule.default);

console.log("=== DIRECT IMPORT TEST ===");
console.log("Agent type:", typeof menuScraperAgent);

async function main() {
  try {
    console.log("Calling agent...");
    await menuScraperAgent({
      name: "Culinary Dropout",
      website: "https://www.culinarydropout.com/locations-menus/",
      menuUrl: "https://www.culinarydropout.com/locations-menus/"
    });
    console.log("Agent finished.");
  } catch (err) {
    console.error("AGENT ERROR:", err);
  }
}

main();
