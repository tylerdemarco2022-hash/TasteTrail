// Remove price field from all menu items
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'Chilis_Menu.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const cleaned = data.map(item => {
  const { price, ...rest } = item;
  return rest;
});

fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2));
console.log(`Removed price from ${cleaned.length} items`);
