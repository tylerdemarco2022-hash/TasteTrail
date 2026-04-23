import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Testing JSON parsing paths...\n');

// Test 1: Try reading restaurant-images.json
console.log('📋 Test 1: Testing restaurant-images.json parsing');
const imagePath = path.join(__dirname, 'backend/data/restaurant-images.json');
try {
  if (fs.existsSync(imagePath)) {
    let images;
    try {
      images = JSON.parse(fs.readFileSync(imagePath, 'utf8'));
      console.log('✅ Successfully parsed restaurant-images.json');
      console.log(`   Found ${Array.isArray(images) ? images.length : Object.keys(images).length} records\n`);
    } catch (err) {
      console.error('❌ JSON PARSE FAILED in restaurant-images.json');
      console.error('   Error:', err.message);
      console.error('   Stack:', err.stack);
      const rawContent = fs.readFileSync(imagePath, 'utf8');
      console.error('   First 500 chars:', rawContent?.slice?.(0, 500));
    }
  } else {
    console.log('⚠️  restaurant-images.json not found\n');
  }
} catch (err) {
  console.error('❌ Error reading restaurant-images.json:', err.message);
}

// Test 2: Try reading menu cache if it exists
console.log('📋 Test 2: Testing menu cache parsing (if exists)');
const menuCachePath = path.join(__dirname, 'backend/data/menu-cache');
if (fs.existsSync(menuCachePath)) {
  const cacheFiles = fs.readdirSync(menuCachePath).filter(f => f.endsWith('.json')).slice(0, 3);
  for (const file of cacheFiles) {
    const filePath = path.join(menuCachePath, file);
    try {
      let data;
      try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`✅ Successfully parsed ${file}`);
      } catch (err) {
        console.error(`❌ JSON PARSE FAILED in ${file}`);
        console.error('   Error:', err.message);
        const rawContent = fs.readFileSync(filePath, 'utf8');
        console.error('   First 500 chars:', rawContent?.slice?.(0, 500));
      }
    } catch (err) {
      console.error(`Error reading ${file}:`, err.message);
    }
  }
  console.log('');
} else {
  console.log('⚠️  Menu cache directory not found\n');
}

// Test 3: URL discovery cache
console.log('📋 Test 3: Testing URL discovery cache parsing');
const urlCachePath = path.join(__dirname, 'menu-urls-found.json');
try {
  if (fs.existsSync(urlCachePath)) {
    let urlCache;
    try {
      urlCache = JSON.parse(fs.readFileSync(urlCachePath, 'utf8'));
      console.log('✅ Successfully parsed menu-urls-found.json');
      console.log(`   Found ${Object.keys(urlCache).length} cached URLs\n`);
    } catch (err) {
      console.error('❌ JSON PARSE FAILED in menu-urls-found.json');
      console.error('   Error:', err.message);
      const rawContent = fs.readFileSync(urlCachePath, 'utf8');
      console.error('   First 500 chars:', rawContent?.slice?.(0, 500));
      console.error('');
    }
  } else {
    console.log('⚠️  menu-urls-found.json not found\n');
  }
} catch (err) {
  console.error('❌ Error reading menu-urls-found.json:', err.message);
}

console.log('✨ JSON parsing diagnostic test complete');
