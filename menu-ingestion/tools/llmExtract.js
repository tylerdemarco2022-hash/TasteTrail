#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { searchRestaurants, getPlaceDetails } from '../services/googlePlaces.js'
import { discoverWebsiteWithLLM } from '../services/llmDiscovery.js'
import { scrapeMenu } from '../services/menuScraper.js'
import { parseMenuWithAI } from '../services/aiMenuParser.js'

// Load .env from project root and menu-ingestion folder so OPENAI_API_KEY is available
try {
  const envPaths = [path.join(process.cwd(), '.env'), path.join(process.cwd(), 'menu-ingestion', '.env')]
  for (const pth of envPaths) {
    if (!fs.existsSync(pth)) continue
    const raw = fs.readFileSync(pth, 'utf8')
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (m) {
        const k = m[1]
        let v = m[2]
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
        if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1)
        if (process.env[k] === undefined || process.env[k] === '') process.env[k] = v
      }
    })
  }
} catch (e) {
  // ignore
}

async function discoverMenuUrl(websiteUrl) {
  if (!websiteUrl) return null
  try {
    const res = await fetch(websiteUrl)
    if (!res.ok) return null
    const html = await res.text()
    const menuMatch = html.match(/href=["']([^"']*menu[^"']*)["']/i)
    if (!menuMatch) return null
    const link = menuMatch[1]
    const menuUrl = link.startsWith('http') ? link : new URL(link, websiteUrl).toString()
    return menuUrl
  } catch (e) {
    return null
  }
}

async function run() {
  const args = process.argv.slice(2)
  if (!args.length) {
    console.error('Usage: node llmExtract.js "Restaurant Name" [--save out.json]')
    process.exit(2)
  }
  const name = args[0]
  const saveIndex = args.indexOf('--save')
  const outPath = saveIndex !== -1 ? args[saveIndex + 1] : null

  console.log(`Searching for: ${name}`)
  let results
  // Use LLM discovery as primary method (no fallback). It requires OPENAI_API_KEY.
  try {
    const urls = await discoverWebsiteWithLLM(name)
    if (!urls || !urls.length) throw new Error('LLM returned no URLs')
    // construct a minimal result object using the top discovered URL
    results = [{ name, formatted_address: '', place_id: null, website: urls[0], url: urls[0] }]
    console.log('LLM discovery returned URL(s):', urls.join(', '))
  } catch (e) {
    console.error('LLM discovery failed:', e.message)
    console.error('Set OPENAI_API_KEY in your .env to enable LLM-based discovery.')
    process.exit(1)
  }

  if (!results || !results.length) {
    console.error('No search results found')
    process.exit(1)
  }

  const top = results[0]
  console.log('Found:', top.name, top.formatted_address || '', top.place_id || '')

  let details
  let website = null
  if (top.place_id) {
    try {
      details = await getPlaceDetails(top.place_id)
      website = details.website || details.url || null
    } catch (e) {
      console.warn('Place details failed, continuing with available data:', e.message)
    }
  }
  // If website still missing, try fields on the top result
  website = website || top.website || top.url || null
  console.log('Website:', website)

  let menuUrl = await discoverMenuUrl(website)
  if (menuUrl) console.log('Discovered menu URL:', menuUrl)

  const targetUrl = menuUrl || website
  if (!targetUrl) {
    console.error('No website or menu URL available')
    process.exit(1)
  }

  console.log('Scraping:', targetUrl)
  let scrapeResult
  try {
    scrapeResult = await scrapeMenu(targetUrl)
  } catch (e) {
    console.error('Scrape failed:', e.message)
    process.exit(1)
  }

  let menuJson = { sections: scrapeResult.sections || [] }
  let source = 'scrape'
  if (!menuJson.sections.length) {
    console.log('No structured sections found, invoking AI parser')
    const raw = scrapeResult.rawText || scrapeResult.rawHtml || ''
    try {
      const ai = await parseMenuWithAI(raw)
      menuJson = { sections: ai.sections || [] }
      source = 'ai'
    } catch (e) {
      console.error('AI parse failed:', e.message)
      process.exit(1)
    }
  }

  const out = { restaurant: details.name || name, source, targetUrl, menu: menuJson }

  const outJson = JSON.stringify(out, null, 2)
  if (outPath) {
    await fs.promises.writeFile(outPath, outJson, 'utf8')
    console.log('Saved output to', outPath)
  } else {
    console.log(outJson)
  }
}

run().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
