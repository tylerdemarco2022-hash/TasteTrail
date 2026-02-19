import axios from 'axios'
import * as cheerio from 'cheerio'
import { findDinnerMenuUrl } from '../services/dinnerMenuFinder.js'

const query = 'Midnight Diner Charlotte NC official website'
const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`

const blocked = [
  'yelp.com',
  'tripadvisor.com',
  'doordash.com',
  'ubereats.com',
  'grubhub.com',
  'opentable.com',
  'facebook.com',
  'google.com',
  'maps.google.com'
]

const unwrap = (url) => {
  try {
    const u = new URL(url, 'https://duckduckgo.com')
    if (u.hostname === 'duckduckgo.com' && u.pathname.startsWith('/l/')) {
      const uddg = u.searchParams.get('uddg')
      if (uddg) return decodeURIComponent(uddg)
    }
  } catch {
    return url
  }
  return url
}

const isBlocked = (url) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return blocked.some((b) => host === b || host.endsWith('.' + b))
  } catch {
    return true
  }
}

const res = await axios.get(ddgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
const $ = cheerio.load(res.data)
const links = []

$('a.result__a').each((_, el) => {
  const href = $(el).attr('href')
  if (href) links.push(href)
})

const allLinks = [...new Set(links.map(unwrap))]
const candidates = allLinks.filter((u) => !isBlocked(u))
const website = candidates[0]

console.log('Top results:')
allLinks.slice(0, 10).forEach((u, idx) => console.log(`${idx + 1}. ${u}`))
console.log('Candidate website:', website || 'none')
if (!website) process.exit(0)

const result = await findDinnerMenuUrl(website)
console.log(JSON.stringify({ website, result }, null, 2))
