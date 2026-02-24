import findRestaurantMenuURL from '../scraper/unifiedMenuUrlFinder.js';
import { findDinnerMenuUrl } from '../../src/services/dinnerMenuFinder.js';
import searchAndFetchMenu from '../scraper/auto_menu_fetcher.js';
import fetch from 'node-fetch';
import scrapeMenu from '../scraper/menuScraperAgent.js';

const restaurantName = '131 Main';

async function testFinder(finder, name, label) {
  let url = null;
  let resolves = false;
  let scrapeSections = 0;
  try {
    url = await finder(name);
    console.log(`[${label}] URL:`, url);
    if (url) {
      try {
        const head = await fetch(url, { method: 'HEAD' });
        resolves = head.ok;
        console.log(`[${label}] HEAD resolves:`, resolves);
      } catch (err) {
        console.log(`[${label}] HEAD error:`, err.message);
      }
      try {
        const menu = await scrapeMenu(url, name);
        scrapeSections = menu.menu_sections ? menu.menu_sections.length : 0;
        console.log(`[${label}] Scrape sections:`, scrapeSections);
      } catch (err) {
        console.log(`[${label}] Scrape error:`, err.message);
      }
    }
  } catch (err) {
    console.log(`[${label}] Finder error:`, err.message);
  }
  return { label, url, resolves, scrapeSections };
}

async function runAllFinders() {
  const results = [];
  results.push(await testFinder(findRestaurantMenuURL, restaurantName, 'unifiedMenuUrlFinder'));
  results.push(await testFinder(findDinnerMenuUrl, restaurantName, 'dinnerMenuFinder'));
  results.push(await testFinder(searchAndFetchMenu, restaurantName, 'auto_menu_fetcher'));
  console.log('=== SUMMARY ===');
  for (const r of results) {
    console.log(`${r.label}: URL=${r.url} HEAD=${r.resolves} SECTIONS=${r.scrapeSections}`);
  }
}

runAllFinders();
