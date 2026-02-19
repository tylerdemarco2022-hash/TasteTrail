const fs = require("fs");
const path = require("path");

function saveToFile(name, data) {
  const filePath = path.join(__dirname, `${name.replace(/\s/g, "_")}.json`);

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  console.log(`Saved to ${filePath}`);
}

module.exports = saveToFile;
