// Puppeteer + Cheerio menu scraper
// Respects robots.txt and blocks disallowed domains.

import puppeteer from 'puppeteer'
import * as cheerio from 'cheerio'
import { logger } from '../utils/logger.js'

const BLOCKED_HOSTS = ['yelp.com', 'doordash.com', 'ubereats.com', 'grubhub.com']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function withRetry(fn, { retries = 2, baseMs = 500 } = {}) {
  let lastErr
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const delay = Math.min(4000, baseMs * 2 ** i)
      logger.warn('menuScraper.retry', { attempt: i + 1, delay })
      await sleep(delay)
    }
  }
  throw lastErr
}

function isBlockedHost(targetUrl) {
  try {
    const host = new URL(targetUrl).hostname.replace(/^www\./, '')
    return BLOCKED_HOSTS.some((b) => host === b || host.endsWith(`.${b}`))
  } catch {
    return true
  }
}

async function allowsByRobots(targetUrl) {
  try {
    const url = new URL(targetUrl)
    const robotsUrl = `${url.origin}/robots.txt`
    const res = await fetch(robotsUrl)
    if (!res.ok) return true
    const text = await res.text()
    const lines = text.split(/\r?\n/)
    let active = false
    const disallow = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const [rawKey, rawValue] = trimmed.split(':', 2)
      const key = rawKey?.toLowerCase()
      const value = (rawValue || '').trim()
      if (key === 'user-agent') {
        active = value === '*' ? true : false
      }
      if (active && key === 'disallow') {
        if (value) disallow.push(value)
      }
    }
    const path = url.pathname
    return !disallow.some((rule) => rule !== '/' && path.startsWith(rule))
  } catch (e) {
    return true
  }
}

function sanitizeText(text = '') {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
}

function normalizePrice(raw) {
  if (!raw) return null
  const cleaned = raw.replace(/[^0-9.]/g, '')
  if (!cleaned) return null
  const value = parseFloat(cleaned)
  return Number.isFinite(value) ? value : null
}

function extractMenuFromHtml(html) {
  const $ = cheerio.load(html)

  const sections = []
  const headings = $('h1, h2, h3')

  const priceRegex = /(\$\s?\d+(?:\.\d{1,2})?)|\b\d+(?:\.\d{1,2})?\s?\$/

  headings.each((_, el) => {
    const name = sanitizeText($(el).text())
    if (!name) return

    const items = []
    let sibling = $(el).next()
    let count = 0
    while (sibling.length && count < 8) {
      const text = sanitizeText(sibling.text())
      if (text && priceRegex.test(text)) {
        const lines = text.split(' • ').length > 1 ? text.split(' • ') : text.split('\n')
        lines.forEach((line) => {
          const lineText = sanitizeText(line)
          if (!lineText) return
          const priceMatch = lineText.match(priceRegex)
          const price = normalizePrice(priceMatch?.[0] || '')
          const nameOnly = sanitizeText(lineText.replace(priceRegex, ''))
          if (nameOnly) {
            items.push({
              name: nameOnly,
              description: '',
              price
            })
          }
        })
      }
      sibling = sibling.next()
      count += 1
    }

    if (items.length) {
      sections.push({ name, items })
    }
  })

  if (sections.length) return sections

  // Fallback: find list items with prices
  const fallbackItems = []
  $('li, p, div').each((_, el) => {
    const text = sanitizeText($(el).text())
    if (!text || text.length < 6) return
    if (!priceRegex.test(text)) return
    const priceMatch = text.match(priceRegex)
    const price = normalizePrice(priceMatch?.[0] || '')
    const nameOnly = sanitizeText(text.replace(priceRegex, ''))
    if (nameOnly) {
      fallbackItems.push({ name: nameOnly, description: '', price })
    }
  })

  if (fallbackItems.length) {
    return [{ name: 'Menu', items: fallbackItems.slice(0, 120) }]
  }

  return []
}

export async function scrapeMenu(url) {
  if (!url) throw new Error('Menu URL is missing')
  if (isBlockedHost(url)) throw new Error('Blocked menu host')
  const allowed = await allowsByRobots(url)
  if (!allowed) throw new Error('Disallowed by robots.txt')

  return withRetry(async () => {
    const browser = await puppeteer.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (compatible; MenuIngestBot/1.0)')
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
      const html = await page.content()
      const text = await page.evaluate(() => document.body?.innerText || '')
      const sections = extractMenuFromHtml(html)
      return {
        rawHtml: html,
        rawText: text,
        sections
      }
    } finally {
      await browser.close()
    }
  })
}
