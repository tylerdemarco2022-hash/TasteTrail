#!/usr/bin/env node
/**
 * Clean and re-sanitize all menu.json files
 * Removes non-food items that slipped through earlier parsing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeMenuItems } from '../services/menuQuality.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESTAURANTS_DIR = path.join(__dirname, '../restaurants');

function cleanMenuFile(filePath) {
  try {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(rawContent);
    
    // Handle both array format and object with menu property
    let menuArray;
    if (Array.isArray(data)) {
      menuArray = data;
    } else if (data.menu && Array.isArray(data.menu)) {
      menuArray = data.menu;
    } else {
      console.log(`⏭️  Skipping ${path.basename(path.dirname(filePath))} - invalid format`);
      return {cleaned: false, before: 0, after: 0};
    }

    const beforeCount = menuArray.length;
    const cleaned = sanitizeMenuItems(menuArray);
    const afterCount = cleaned.length;

    if (afterCount === beforeCount) {
      console.log(`✅ ${path.basename(path.dirname(filePath))} - Already clean (${afterCount} items)`);
      return {cleaned: false, before: beforeCount, after: afterCount};
    }

    // Write back in the same format
    if (Array.isArray(data)) {
      fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf8');
    } else {
      data.menu = cleaned;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    
    const removed = beforeCount - afterCount;
    console.log(`🧹 ${path.basename(path.dirname(filePath))} - Removed ${removed} items (${beforeCount} → ${afterCount})`);
    
    return {cleaned: true, before: beforeCount, after: afterCount};
  } catch (error) {
    console.error(`❌ Error cleaning ${filePath}:`, error.message);
    return {cleaned: false, before: 0, after: 0, error: true};
  }
}

function findAllMenuFiles(dir) {
  const menuFiles = [];
  
  function scan(currentDir) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.name === 'menu.json') {
          menuFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Could not scan ${currentDir}:`, error.message);
    }
  }
  
  scan(dir);
  return menuFiles;
}

async function main() {
  console.log('🔍 Scanning for menu.json files...\n');
  
  const menuFiles = findAllMenuFiles(RESTAURANTS_DIR);
  console.log(`Found ${menuFiles.length} menu files\n`);
  
  if (menuFiles.length === 0) {
    console.log('No menu files found. Exiting.');
    return;
  }

  let totalCleaned = 0;
  let totalBefore = 0;
  let totalAfter = 0;
  let errors = 0;

  for (const filePath of menuFiles) {
    const result = cleanMenuFile(filePath);
    if (result.error) {
      errors++;
    } else {
      totalBefore += result.before;
      totalAfter += result.after;
      if (result.cleaned) {
        totalCleaned++;
      }
    }
  }

  const totalRemoved = totalBefore - totalAfter;
  
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Files cleaned:     ${totalCleaned}/${menuFiles.length}`);
  console.log(`🗑️  Items removed:     ${totalRemoved} (${totalBefore} → ${totalAfter})`);
  if (errors > 0) {
    console.log(`❌ Errors:            ${errors}`);
  }
  console.log('='.repeat(60));
}

main().catch(console.error);
