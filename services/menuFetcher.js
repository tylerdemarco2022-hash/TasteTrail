const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')

const axiosInst = axios.create({ timeout: 5000 })

function filterMenuText(input, isHtml = false) {
  try {
    const pricePattern = /\$?\d{1,3}(?:[\.,]\d{2})/
    const linesOut = []
    const seen = new Set()

    if (isHtml && typeof input === 'string' && input.indexOf('<') !== -1) {
      const $ = cheerio.load(input)
      // headings, lists, paragraphs
      const primaryEls = Array.from($("h1,h2,h3,h4,li,p").toArray())
      for (const el of primaryEls) {
        try {
          const t = $(el).text() || ''
          const parts = t.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
          for (const p of parts) if (!seen.has(p)) { seen.add(p); linesOut.push(p) }
        } catch (e) { continue }
      }

      // price-like elements
      try {
        const all = Array.from($('*').toArray())
        for (const el of all) {
          try {
            const t = $(el).text() || ''
            if (pricePattern.test(t)) {
              const parts = t.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
              for (const p of parts) if (!seen.has(p)) { seen.add(p); linesOut.push(p) }
            }
          } catch (e) { continue }
        }
      } catch (e) {}

      // elements inside menu-like classes
      try {
        const selector = "*[class*=menu], *[class*=food], *[class*=dish], *[class*=item]"
        const sectionEls = Array.from($(selector).toArray())
        for (const el of sectionEls) {
          try {
            const t = $(el).text() || ''
            const parts = t.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
            for (const p of parts) if (!seen.has(p)) { seen.add(p); linesOut.push(p) }
          } catch (e) { continue }
        }
      } catch (e) {}
    } else {
      // plain text: dedupe lines and keep those with price-like patterns or non-empty lines
      const parts = (input || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      for (const p of parts) {
        if (!seen.has(p)) { seen.add(p); linesOut.push(p) }
      }
    }

    const joined = linesOut.join('\n')
    const capped = joined.slice(0, 50000)
    try { console.log('Filtered menu text length:', (capped || '').length) } catch (e) {}
    return capped
  } catch (e) {
    return ''
  }
}

async function tryGetWithRetries(url, signal) {
  const maxRetries = 1 // one retry max
  let attempt = 0
  while (attempt <= maxRetries) {
    try {
      return await axiosInst.get(url, { responseType: 'arraybuffer', maxContentLength: 10 * 1024 * 1024, signal })
    } catch (e) {
      // log timeouts specifically
      const isTimeout = e && (e.code === 'ECONNABORTED' || (e.message && e.message.toLowerCase().includes('timeout')))
      if (isTimeout) console.warn('Menu path timed out:', url)
      attempt++
      if (attempt > maxRetries) throw e
      // small backoff before retry
      await new Promise((res) => setTimeout(res, 200 * attempt))
    }
  }
}

async function fetchMenu(restaurant) {
  if (!restaurant || !restaurant.website) return null
  // create cache dir
  const cacheMenusDir = path.join(process.cwd(), 'cache', 'menus')
  try { if (!fs.existsSync(cacheMenusDir)) fs.mkdirSync(cacheMenusDir, { recursive: true }) } catch (e) {}
  // slug for restaurant
  const slugBase = (restaurant.name || restaurant.place_id || restaurant.website || '')
  const slug = (slugBase.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) + (restaurant.place_id ? `-${restaurant.place_id}` : '')
  const cachePath = path.join(cacheMenusDir, `${slug}.txt`)
  // if cached menu exists, use it
  try {
    if (fs.existsSync(cachePath)) {
      console.log('Using cached menu')
      const cached = fs.readFileSync(cachePath, 'utf8')
      if (cached && cached.length) return { sourceUrl: `cache://${slug}`, rawMenuText: cached }
    }
  } catch (e) {}
  const base = restaurant.website.replace(/\/+$/, '')
  const candidates = ['/menu', '/food', '/dinner', '/lunch', '/']

  const overallController = new AbortController()
  const overallSignal = overallController.signal
  let timeoutId = null
  try {
    timeoutId = setTimeout(() => {
      console.warn('Overall menu fetch timeout for', restaurant.name || restaurant.place_id || restaurant.website)
      overallController.abort()
    }, 15000) // max total time per restaurant

    // attempt all paths in parallel
    const attempts = candidates.map((p) => (async () => {
      const url = p === '/' ? base : base + p
      try {
        const res = await tryGetWithRetries(url, overallSignal)
        if (!res) return null
        const contentType = (res.headers['content-type'] || '').toLowerCase()

        // PDF
        if (contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
          try {
            let text = null
            try {
              const pdfParse = require('pdf-parse')
              const buf = Buffer.from(res.data)
              const parsed = await pdfParse(buf)
              text = parsed.text || ''
            } catch (e) {
              console.warn('pdf-parse not available; skipping PDF text extraction for', url)
            }
            if (text && text.trim()) {
              // found valid menu, abort others
              overallController.abort()
              return { sourceUrl: url, rawMenuText: text }
            }
            return { sourceUrl: url, rawMenuText: text || null }
          } catch (e) {
            return null
          }
        }

        // HTML
        const html = res.data.toString('utf8')
        // apply shared filtering on the HTML to extract likely menu text
        const filtered = filterMenuText(html, true)
        if (filtered && filtered.length >= 1500) {
          overallController.abort()
          return { sourceUrl: url, rawMenuText: filtered }
        }
        return { sourceUrl: url, rawMenuText: filtered || null }
      } catch (e) {
        // if aborted due to overall timeout or another success, return null
        return null
      }
    })())

    const settled = await Promise.allSettled(attempts)
    // find first successful with non-empty rawMenuText and sufficient length
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value && s.value.rawMenuText) {
        try {
          const raw = s.value.rawMenuText || ''
          console.log('Raw menu text length:', raw.length)
          if ((raw.length || 0) < 1500) {
            // skip short/junk results
            continue
          }
        } catch (logErr) {}
        // save raw menu cache
        try { fs.writeFileSync(cachePath, s.value.rawMenuText, 'utf8') } catch (e) {}
        return s.value
      }
    }

    // If static scraping didn't find a sufficiently large menu, try Playwright dynamic rendering for candidates
    // Collect candidate URLs that had short or missing content
    const dynamicCandidates = []
    for (let i = 0; i < candidates.length; i++) {
      const s = settled[i]
      const url = candidates[i] === '/' ? base : base + candidates[i]
      if (!s) { dynamicCandidates.push(url); continue }
      if (s.status === 'fulfilled') {
        const val = s.value
        if (!val || !val.rawMenuText || (val.rawMenuText && val.rawMenuText.length < 2000)) dynamicCandidates.push(url)
      } else {
        dynamicCandidates.push(url)
      }
    }

    if (dynamicCandidates.length === 0) return null

    // Playwright dynamic fallback (only when needed)
    try {
      const playwright = (() => { try { return require('playwright') } catch (e) { return null } })()
      if (!playwright) {
        console.warn('Playwright not installed; skipping dynamic rendering')
        return null
      }

      // reuse browser for this restaurant's dynamic attempts, but close after we're done
      const browser = await playwright.chromium.launch({ headless: true })
      try {
        for (const url of dynamicCandidates) {
          if (overallSignal.aborted) break
          try {
            console.info('Using Playwright to render', url)
            const page = await browser.newPage()
            // set max render time 10s
            try {
              await page.goto(url, { timeout: 10000, waitUntil: 'networkidle' })
            } catch (navErr) {
              console.warn('Playwright navigation failed for', url)
              try { await page.close() } catch {}
              continue
            }
            // prefer detected menu links on the page
            let bodyText = ''
            try {
              // collect anchor hrefs (page.$$eval returns absolute hrefs when available)
              let menuLinks = []
              try {
                menuLinks = await page.$$eval('a', (els) => els.map(a => a.href || a.getAttribute('href') || '').filter(Boolean))
              } catch (e) {
                menuLinks = []
              }

              const keywords = ['menu', 'food', 'dinner', 'lunch', 'eat']
              let candidateLink = null
              for (const href of menuLinks) {
                try {
                  const l = href.toLowerCase()
                  if (keywords.some(k => l.includes(k))) {
                    candidateLink = href
                    break
                  }
                } catch (e) {
                  continue
                }
              }

              if (candidateLink) {
                console.log('Navigating to detected menu link:', candidateLink)
                try {
                  await page.goto(candidateLink, { timeout: 10000, waitUntil: 'networkidle' })
                } catch (navErr) {
                  console.warn('Playwright navigation to detected menu link failed:', candidateLink)
                }
              }

              try {
                bodyText = await page.evaluate(() => {
                  function extractTextFromElements(els) {
                    const out = []
                    for (const el of els) {
                      try {
                        const t = (el.innerText || '').trim()
                        if (t) out.push(t)
                      } catch (e) { continue }
                    }
                    return out
                  }

                  // collect headings, list items, paragraphs
                  const primary = extractTextFromElements(Array.from(document.querySelectorAll('h1,h2,h3,h4,li,p')))

                  // collect elements that contain price-like patterns
                  const pricePattern = /\$?\d{1,3}(?:[\.,]\d{2})/;
                  const priceEls = []
                  try {
                    const all = Array.from(document.querySelectorAll('*'))
                    for (const el of all) {
                      try {
                        const txt = (el.innerText || '')
                        if (pricePattern.test(txt)) priceEls.push(txt.trim())
                      } catch (e) { continue }
                    }
                  } catch (e) {}

                  // collect elements inside sections with class names hinting menu content
                  const sectionEls = []
                  try {
                    const all = Array.from(document.querySelectorAll('*'))
                    for (const el of all) {
                      try {
                        const cls = (el.className || '').toString().toLowerCase()
                        if (cls && /menu|food|dish|item/.test(cls)) {
                          const t = (el.innerText || '').trim()
                          if (t) sectionEls.push(t)
                        }
                      } catch (e) { continue }
                    }
                  } catch (e) {}

                  // combine and dedupe lines while preserving order
                  const combined = []
                  const seen = new Set()
                  function pushLines(arr) {
                    for (const block of arr) {
                      const lines = (block || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
                      for (const line of lines) {
                        if (!seen.has(line)) { seen.add(line); combined.push(line) }
                      }
                    }
                  }

                  pushLines(primary)
                  pushLines(sectionEls)
                  pushLines(priceEls)

                  // final string
                  const joined = combined.join('\n')
                  // cap to 50,000 characters
                  return joined.slice(0, 50000)
                })
              } catch (e) { bodyText = '' }
              try { console.log('Filtered menu text length (raw from page.evaluate):', (bodyText || '').length) } catch (e) {}
            } catch (e) { bodyText = '' }
            try { await page.close() } catch {}
            // further normalize and apply the same filtering step to ensure consistency
            const filteredFromPage = filterMenuText(bodyText || '', false)
            try {
              console.log('Filtered menu text length (after unified filter):', (filteredFromPage || '').length)
            } catch (e) {}
            if (filteredFromPage && filteredFromPage.length >= 1500) {
              // save cache
              try { fs.writeFileSync(cachePath, filteredFromPage, 'utf8') } catch (e) {}
              overallController.abort()
              return { sourceUrl: url, rawMenuText: filteredFromPage }
            }
          } catch (e) {
            // continue to next URL
            continue
          }
        }
      } finally {
        try {
          await browser.close()
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Dynamic rendering failed:', e instanceof Error ? e.message : String(e))
    }

    // no menu found after dynamic attempts
    return null
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
    try { overallController.abort() } catch {}
  }
}

module.exports = { fetchMenu }
