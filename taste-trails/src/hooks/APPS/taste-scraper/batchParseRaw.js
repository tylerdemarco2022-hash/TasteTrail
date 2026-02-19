const fs = require("fs");
const path = require("path");
const parseMenu = require("./aiParser");
const saveToFile = require("./save");

function toTitleFromFile(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  const withoutRaw = base.replace(/_raw$/i, "");
  return withoutRaw.replace(/_/g, " ").trim();
}

async function run() {
  const listFile = process.argv[2];
  if (!listFile) {
    console.error("Usage: node batchParseRaw.js <listFile>");
    process.exit(1);
  }

  const listPath = path.isAbsolute(listFile)
    ? listFile
    : path.join(__dirname, listFile);

  const lines = fs
    .readFileSync(listPath, "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    console.log("No raw files to parse.");
    return;
  }

  for (const rawFile of lines) {
    const rawPath = path.isAbsolute(rawFile)
      ? rawFile
      : path.join(__dirname, rawFile);

    const rawText = fs.readFileSync(rawPath, "utf-8");
    const structuredMenu = await parseMenu(rawText);

    const outputName = toTitleFromFile(rawPath);
    saveToFile(outputName, structuredMenu);
  }
}

run().catch((error) => {
  console.error("Error parsing raw menus:", error && error.message ? error.message : String(error));
  process.exit(1);
});
