import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config()
import { ocrFromUrl } from './ocr_parse.js'
import axios from 'axios'
import { supabase } from './supabase.js'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const YELP_API_KEY = process.env.YELP_API_KEY

// This script demonstrates the pipeline for a small set of restaurants saved in ./data/yelp_charlotte.json
// For each business it will attempt to find photos from the Yelp business details (requires calling business endpoint),
// run OCR on each photo, and then call OpenAI to parse into structured menu JSON. Finally it upserts to Supabase.

async function callOpenAI(prompt) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing')
  const url = 'https://api.openai.com/v1/chat/completions'
  const res = await axios.post(url, {
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: 'You are a menu parsing assistant. Return only JSON.' }, { role: 'user', content: prompt }],
    temperature: 0
  }, { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } })
  return res.data
}

function buildPrompt(restaurantName, ocrText) {
  return `Extract menu items from the following OCR text captured from a restaurant menu image. Return a JSON object with keys: restaurant, menu (array of {dish, price, category, description}).\nRestaurant: ${restaurantName}\nOCR_TEXT:\n${ocrText}\n
Respond with only valid JSON.`
}

async function processBusiness(biz) {
  try {
    const bizId = biz.id
    // fetch business details to get photos
    const details = await axios.get(`https://api.yelp.com/v3/businesses/${bizId}`, { headers: { Authorization: `Bearer ${YELP_API_KEY}` } }).then(r => r.data).catch(() => null)
    const photos = (details && details.photos) || []
    const ocrs = []
    for (const p of photos) {
      try {
        const text = await ocrFromUrl(p)
        ocrs.push(text)
      } catch (e) {
        console.warn('OCR failed for', p)
      }
    }
    const joined = ocrs.join('\n')
    if (!joined) return null
    const prompt = buildPrompt(biz.name, joined)
    const aiRes = await callOpenAI(prompt)
    // parse model output (this is a simplification; production code should validate)
    const content = aiRes.choices?.[0]?.message?.content || ''
    let parsed = null
    try { parsed = JSON.parse(content) } catch (e) { console.warn('Failed to parse JSON from OpenAI') }
    if (parsed && parsed.menu) {
      const record = { name: parsed.restaurant || biz.name, yelp_id: biz.id, menu: parsed.menu }
      // upsert into Supabase
      try {
        await supabase.from('restaurants').upsert({ name: record.name, yelp_id: record.yelp_id, menu: record.menu }).select()
      } catch (e) { console.warn('Supabase upsert failed', e.message) }
      return record
    }
    return null
  } catch (e) {
    console.error('processBusiness error', e.message)
    return null
  }
}

async function main() {
  const file = path.resolve('./data/yelp_charlotte.json')
  if (!fs.existsSync(file)) {
    console.error('Run `npm run yelp-fetch` first to create ./data/yelp_charlotte.json')
    process.exit(1)
  }
  const raw = fs.readFileSync(file, 'utf8')
  const json = JSON.parse(raw)
  const businesses = json.businesses || []
  for (const b of businesses.slice(0, 20)) {
    console.log('Processing', b.name)
    const result = await processBusiness(b)
    if (result) console.log('Processed', result.name)
    await new Promise(r=>setTimeout(r, 500))
  }
}

if (require.main === module) main()
