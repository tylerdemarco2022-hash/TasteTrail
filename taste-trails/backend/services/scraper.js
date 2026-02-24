import puppeteer from 'puppeteer'

export async function scrapeMenu(url) {
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  )

  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 20000
  })

  const text = await page.evaluate(() => {
    return document.body.innerText
  })

  await browser.close()

  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  const items = []

  for (let line of lines) {
    if (/\$\d+/.test(line)) {
      items.push(line)
    }
  }

  return {
    menu_sections: [
      {
        title: 'Extracted Items',
        items
      }
    ],
    confidence: items.length > 5 ? 70 : 30
  }
}
