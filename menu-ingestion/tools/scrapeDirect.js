#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { scrapeMenu } from '../services/menuScraper.js'
import { parseMenuWithAI } from '../services/aiMenuParser.js'

// load .env from root and menu-ingestion
try {
  const envFiles = [path.join(process.cwd(), '.env'), path.join(process.cwd(), 'menu-ingestion', '.env')]
  for (const p of envFiles) {
    if (!fs.existsSync(p)) continue
    const raw = fs.readFileSync(p, 'utf8')
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

async function run() {
  const args = process.argv.slice(2)
  if (!args.length) {
    console.error('Usage: node scrapeDirect.js <url> [--save out.json]')
    process.exit(2)
  }
  const url = args[0]
  const saveIndex = args.indexOf('--save')
  const outPath = saveIndex !== -1 ? args[saveIndex + 1] : 'menu-ingestion/tools/out.json'

  console.log('Scraping URL:', url)
  try {
    const res = await scrapeMenu(url)
    let menuJson = { sections: res.sections || [] }
    let source = 'scrape'
    if (!menuJson.sections.length) {
      console.log('No structured sections found, running AI parser fallback')
      const raw = res.rawText || res.rawHtml || ''
      const ai = await parseMenuWithAI(raw)
      menuJson = { sections: ai.sections || [] }
      source = 'ai'
    }

    const out = { source, url, menu: menuJson }
    await fs.promises.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8')
    console.log('Saved output to', outPath)
  } catch (e) {
    console.error('Failed to scrape:', e.message)
    process.exit(1)
  }
}

run()
