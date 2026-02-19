const fs = require("fs");
const path = require("path");
const parseMenu = require("./aiParser");
const saveToFile = require("./save");

async function run() {
  const rawFile = process.argv[2];
  const outputName = process.argv[3] || "Parsed_Menu";

  if (!rawFile) {
    console.error("Usage: node parseRaw.js <rawTextFile> [outputName]");
    process.exit(1);
  }

  const rawPath = path.isAbsolute(rawFile)
    ? rawFile
    : path.join(__dirname, rawFile);

  const rawText = fs.readFileSync(rawPath, "utf-8");
  const structuredMenu = await parseMenu(rawText);

  saveToFile(outputName, structuredMenu);
}

run().catch((error) => {
  console.error("Error parsing raw menu:", error && error.message ? error.message : String(error));
  process.exit(1);
});
