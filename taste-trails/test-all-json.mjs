import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('Testing JSON parsing on all data files...\n');

const files = [
  'backend/data/menus.json',
  'backend/data/restaurants.json',
  'backend/data/restaurant-images.json',
  'menu-urls-found.json'
];

for (const file of files) {
  const filePath = join(__dirname, file);
  console.log(`📄 Testing: ${file}`);
  try {
    const content = readFileSync(filePath, 'utf8');
    console.log(`   Size: ${content.length} bytes`);
    
    let parsed;
    try {
      parsed = JSON.parse(content);
      console.log(`   ✅ Successfully parsed`);
      if (Array.isArray(parsed)) {
        console.log(`   Items: ${parsed.length}`);
      } else if (typeof parsed === 'object') {
        console.log(`   Keys: ${Object.keys(parsed).length}`);
      }
    } catch (jsonErr) {
      console.error(`   ❌ JSON PARSE ERROR`);
      console.error(`      Message: ${jsonErr.message}`);
      console.error(`      Position: ${jsonErr.stack?.substring(0, 200)}`);
      // Show a snippet around where the error might be
      const pos = content.indexOf('\\u');
      if (pos !== -1) {
        console.error(`      Found bad escape at position ${pos}:`);
        console.error(`      Context: ...${content.substring(Math.max(0, pos-20), Math.min(content.length, pos+20))}...`);
      }
    }
  } catch (err) {
    console.warn(`   ⚠️  File not found or read error: ${err.message}`);
  }
  console.log('');
}

console.log('✨ JSON parsing test complete');
