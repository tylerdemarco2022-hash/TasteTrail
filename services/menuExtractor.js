

import { OpenAI } from 'openai';
import fs from 'fs';
import * as cheerio from 'cheerio';

const client = (() => {
  if (!process.env.OPENAI_API_KEY) return null
  try { return new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) } catch (e) { return null }
})()

function chunkText(text, size = 16000) {
  const chunks = []
  let i = 0
  while (i < text.length) {
    chunks.push(text.slice(i, i + size))
    i += size
  }
  return chunks
}

function mergeMenus(menus) {
  const merged = { categories: [] }
  const catMap = new Map()
  for (const m of menus) {
    if (!m || !Array.isArray(m.categories)) continue
    for (const c of m.categories) {
      const key = (c.category || '').trim() || 'Uncategorized'
      if (!catMap.has(key)) {
        catMap.set(key, { category: key, items: [] })
      }
      const dest = catMap.get(key)
      for (const it of c.items || []) {
        const name = (it.dish_name || '').trim()
        if (!name) continue
        // dedupe by name+price
        const exists = dest.items.find(x => x.dish_name.trim().toLowerCase() === name.toLowerCase() && (x.price || '') === (it.price || ''))
        if (!exists) dest.items.push({ dish_name: name, description: (it.description || '').trim(), price: (it.price || '').trim() })
      }
    }
  }
  merged.categories = Array.from(catMap.values())
  return merged
}

async function callOpenAIForChunk(chunk) {
  if (!client) throw new Error('OPENAI_API_KEY missing')
  const system = { role: 'system', content: `You are a restaurant menu data extraction engine.

The input text may contain navigation, footer content, and other non-menu text.

Your job:

Identify all food and drink items listed.
Infer categories if explicit headers are missing.
Extract dish names even if prices are missing.
If menu structure is unclear, still extract likely dish names.
Do NOT return empty categories unless no food items exist.

Return strict JSON:
{
  "categories": [
    {
      "category": "Category Name",
      "items": [ { "dish_name": "", "description": "", "price": "" } ]
    }
  ]
}

If no clear categories exist, use:
category: "Menu Items"

Never return an empty categories array unless the page clearly contains no menu items.` }
  const user = { role: 'user', content: `Extract the complete structured menu from this text:\n\n${chunk}\n\nReturn format:\n{\n"categories": [ { "category": "", "items": [ { "dish_name": "", "description": "", "price": "" } ] } ] \n}` }

  // use temperature 0
  const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [system, user], temperature: 0 })
  const txt = (resp?.choices?.[0]?.message?.content) || ''
  // try to extract JSON substring
  const jsonMatch = txt.match(/\{[\s\S]*\}$/m)
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(txt)
  return parsed
}


/**
 * Enhanced menu extraction: logs <li> count, price matches, HTML length, headings, and saves HTML snapshot.
 * @param {string} urlOrHtml - If a URL, fetch and parse; if HTML, parse directly.
 */
export async function extractFullMenu(urlOrHtml) {
  let html = '';
  let url = '';
  if (/^https?:\/\//.test(urlOrHtml)) {
    url = urlOrHtml;
    console.log('Scraping URL:', url);
    const axios = (await import('axios')).default;
    const resp = await axios.get(url);
    html = resp.data;
  } else {
    html = urlOrHtml;
    url = '[raw HTML input]';
    console.log('Scraping raw HTML input');
  }

  // Save HTML snapshot
  try {
    fs.writeFileSync('debug_menu_page.html', html);
    console.log('Saved HTML snapshot to debug_menu_page.html');
  } catch (e) {
    console.warn('Failed to save HTML snapshot:', e.message);
  }

  // Parse HTML
  const $ = cheerio.load(html);
  const liCount = $('li').length;
  const htmlLength = html.length;
  // Price pattern: $12, 12.00, $12.00
  const priceRegex = /\$\s?\d{1,3}(?:\.\d{2})?|\b\d{1,3}\.\d{2}\b/g;
  const priceMatches = html.match(priceRegex) || [];
  // Headings detection
  const menuKeywords = [
    'appetizer', 'entree', 'burger', 'sandwich', 'salad', 'pizza', 'pasta', 'starter', 'main', 'dinner', 'lunch', 'dessert', 'drink', 'beverage', 'soup', 'seafood', 'steak', 'special', 'kids', 'side', 'combo', 'platter', 'wrap', 'grill', 'chicken', 'fish', 'beef', 'pork', 'vegetarian', 'vegan', 'gluten', 'brunch', 'breakfast'
  ];
  const headings = [];
  $('h1,h2,h3').each((i, el) => {
    const txt = $(el).text().toLowerCase();
    if (menuKeywords.some(k => txt.includes(k))) {
      headings.push(txt);
    }
  });
  // Lunch/dinner detection
  const isLunch = headings.some(h => h.includes('lunch'));
  const isDinner = headings.some(h => h.includes('dinner'));
  console.log('Total <li> count:', liCount);
  console.log('Total price matches found:', priceMatches.length);
  console.log('Raw HTML length:', htmlLength);
  console.log('Menu-related headings:', headings);
  if (isLunch) console.log('Detected: LUNCH menu');
  if (isDinner) console.log('Detected: DINNER menu');

  // Extract visible text for LLM
  const visibleText = $('body').text();
  // chunk large menus
  const chunks = chunkText(visibleText, 15000);
  const results = [];
  for (const c of chunks) {
    try {
      const r = await callOpenAIForChunk(c);
      results.push(r);
    } catch (e) {
      // continue; don't crash entire job
      console.warn('OpenAI menu chunk failed:', e instanceof Error ? e.message : String(e));
    }
  }
  const merged = mergeMenus(results);
  // Clean items: remove short or generic entries before saving
  try {
    const blacklist = ['food','snacks','drinks','beer','promotions','games'];
    for (const cat of merged.categories || []) {
      const items = Array.isArray(cat.items) ? cat.items : [];
      const normalized = items.map(it => ({
        ...it,
        name: (it.name || it.dish_name || '').trim()
      }));
      const cleanedItems = normalized.filter(item =>
        item.name &&
        item.name.length > 2 &&
        !blacklist.includes(item.name.toLowerCase())
      );
      cat.items = cleanedItems;
    }
  } catch (cleanErr) {
    // non-fatal
    console.warn('Menu cleaning failed:', cleanErr instanceof Error ? cleanErr.message : String(cleanErr));
  }
  try {
    const allDishes = (merged.categories || []).flatMap(c => c.items || []);
    const first10 = allDishes.slice(0, 10).map(d => d.name || d.dish_name || '').filter(Boolean);
    console.log('First 10 extracted dish names:', first10);
    const totalDishCount = allDishes.length;
    console.log('Extracted categories:', (merged.categories && merged.categories.length) || 0);
    console.log('Total dishes extracted:', totalDishCount);
  } catch (logErr) {
    // non-fatal logging error
  }
  return merged;
}



