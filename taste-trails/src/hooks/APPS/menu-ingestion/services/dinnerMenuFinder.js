import axios from 'axios'
import * as cheerio from 'cheerio'

const POSITIVE_KEYWORDS = ['dinner', 'menu', 'food', 'dining', 'eat']

const NEGATIVE_KEYWORDS = [
  'brunch',
  'lunch',
  'breakfast',
  'catering',
  'private',
  'event',
  'career',
  'gift',
  'wine-club'
]

function scoreUrl(url) {
  let score = 0
  const lower = url.toLowerCase()

  POSITIVE_KEYWORDS.forEach((word) => {
    if (lower.includes(word)) score += 3
  })

  NEGATIVE_KEYWORDS.forEach((word) => {
    if (lower.includes(word)) score -= 5
  })

  if (lower.endsWith('.pdf')) score += 2

  return score
}

export async function findDinnerMenuUrl(websiteUrl) {
  try {
    const { data } = await axios.get(websiteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    })

    const $ = cheerio.load(data)
    const candidates = []

    $('a').each((_, el) => {
      const href = $(el).attr('href')
      if (!href) return

      let fullUrl = href

      if (href.startsWith('/')) {
        fullUrl = new URL(href, websiteUrl).href
      }

      if (href.startsWith('http') || href.startsWith('/')) {
        candidates.push(fullUrl)
      }
    })

    const unique = [...new Set(candidates)]

    const scored = unique
      .map((url) => ({
        url,
        score: scoreUrl(url)
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)

    if (!scored.length) {
      return { status: 'dinner_menu_not_found' }
    }

    return {
      status: 'success',
      bestMatch: scored[0].url,
      allCandidates: scored
    }
  } catch (error) {
    return { status: 'error' }
  }
}
