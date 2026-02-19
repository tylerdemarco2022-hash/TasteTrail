import axios from 'axios'
import * as cheerio from 'cheerio'

const MENU_KEYWORDS = ['menu', 'menus', 'dinner', 'food', 'eat', 'dining']

export async function findMenuUrls(restaurantWebsite) {
  try {
    if (!restaurantWebsite) return []
    const { data } = await axios.get(restaurantWebsite, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 15000
    })

    const $ = cheerio.load(data)
    const links = []

    $('a').each((_, el) => {
      const href = $(el).attr('href')
      const text = $(el).text().toLowerCase()
      if (!href) return

      const combined = `${href} ${text}`.toLowerCase()
      if (!MENU_KEYWORDS.some((keyword) => combined.includes(keyword))) return

      let fullUrl = href
      if (href.startsWith('/')) {
        fullUrl = new URL(href, restaurantWebsite).href
      }

      links.push(fullUrl)
    })

    return [...new Set(links)]
  } catch (error) {
    return []
  }
}

export function prioritizeDinnerMenus(urls) {
  return urls.sort((a, b) => {
    const score = (url) => {
      let s = 0
      if (url.includes('dinner')) s += 3
      if (url.includes('menu')) s += 2
      if (url.endsWith('.pdf')) s += 1
      return s
    }
    return score(b) - score(a)
  })
}
