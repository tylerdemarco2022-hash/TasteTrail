require("dotenv").config();
const fs = require("fs");
const parseMenu = require("./aiParser");

async function parseChilis() {
  try {
    const raw = fs.readFileSync("Chilis_Menu_raw.txt", "utf8");
    console.log("Raw text length:", raw.length, "chars");
    
    const result = await parseMenu(raw);
    
    fs.writeFileSync("Chilis_Menu.json", JSON.stringify(result, null, 2));
    console.log("Successfully parsed", result.length, "menu items");
    console.log("\nSample items:");
    result.slice(0, 5).forEach((item, i) => {
      console.log(`${i + 1}. [${item.category}] ${item.name} - ${item.price}`);
    });
  } catch (e) {
    console.error("Error:", e.message);
  }
}

parseChilis();
