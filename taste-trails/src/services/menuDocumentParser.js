const ENTITY = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  nbsp: ' '
}

const SECTION_HEADER = /^[A-Z0-9 &+/'-]{3,32}$/

function decode(value) {
  return String(value || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
      const key = entity.toLowerCase()
      if (ENTITY[key]) return ENTITY[key]
      if (key.startsWith('#x')) return String.fromCodePoint(parseInt(key.slice(2), 16))
      if (key.startsWith('#')) return String.fromCodePoint(parseInt(key.slice(1), 10))
      return match
    })
    .replace(/\s+/g, ' ')
    .trim()
}

function typesOf(node) {
  const value = node?.['@type']
  const list = Array.isArray(value) ? value : [value]
  return list.filter(Boolean).map((entry) => String(entry).toLowerCase())
}

function priceAmount(value) {
  if (value == null || value === '') return null
  const match = String(value).replace(/,/g, '').match(/(\d{1,3}(?:\.\d{2})?)/)
  if (!match) return null
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount < 1 || amount > 250) return null
  return amount
}

function priceFromOffers(offers) {
  const list = Array.isArray(offers) ? offers : [offers]
  for (const offer of list) {
    if (!offer || typeof offer !== 'object') continue
    const amount = priceAmount(offer.price ?? offer.priceSpecification?.price)
    if (amount != null) return amount
  }
  return null
}

function pushItem(items, seen, raw) {
  const name = decode(raw?.name)
  if (!name || name.length < 2 || name.length > 80) return
  if (!/[a-z]/i.test(name)) return
  if (/^(menu|home|about|contact|order|reservations?|privacy policy|gift cards?)$/i.test(name)) return
  const key = name.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  const description = decode(raw?.description)
  items.push({
    name,
    description: description || null,
    category: decode(raw?.category) || null,
    price: raw?.price ?? null
  })
}

function walkJsonLd(node, category, items, seen) {
  if (!node) return
  if (Array.isArray(node)) {
    for (const entry of node) walkJsonLd(entry, category, items, seen)
    return
  }
  if (typeof node !== 'object') return
  const types = typesOf(node)
  if (types.includes('menusection')) {
    const nextCategory = decode(node.name) || category
    walkJsonLd(node.hasMenuItem || node.itemListElement || node.hasMenuSection, nextCategory, items, seen)
    return
  }
  if (types.includes('menuitem')) {
    pushItem(items, seen, {
      name: node.name,
      description: node.description,
      category,
      price: priceFromOffers(node.offers)
    })
  }
  if (Array.isArray(node['@graph'])) walkJsonLd(node['@graph'], category, items, seen)
  if (node.hasMenuSection) walkJsonLd(node.hasMenuSection, category, items, seen)
  if (node.hasMenuItem) walkJsonLd(node.hasMenuItem, category, items, seen)
}

function jsonLdBlocks(html) {
  const blocks = []
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match = pattern.exec(html)
  while (match) {
    try {
      blocks.push(JSON.parse(match[1].trim()))
    } catch {
      // Ignore broken structured data. It is not a menu.
    }
    match = pattern.exec(html)
  }
  return blocks
}

function htmlTitles(html) {
  const titles = []
  const pattern = /menu-item-title[^>]*>([\s\S]*?)<\/h[1-6]>/gi
  let match = pattern.exec(html)
  while (match) {
    const name = decode(match[1])
    const words = name.split(' ').filter(Boolean)
    if (name && name.length <= 50 && words.length <= 8 && words.length >= 1) titles.push(name)
    match = pattern.exec(html)
  }
  return titles
}

export function parseMenuHtml(html) {
  const text = String(html || '')
  const items = []
  const seen = new Set()
  for (const block of jsonLdBlocks(text)) walkJsonLd(block, null, items, seen)
  for (const name of htmlTitles(text)) pushItem(items, seen, { name })
  return items
}

function cleanLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line
      .replace(/(?:\s*\.\s*){3,}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean)
}

function numberCount(line) {
  return (line.match(/\d+(?:\.\d+)?/g) || []).length
}

function isSectionHeader(line) {
  if (!SECTION_HEADER.test(line)) return false
  if (numberCount(line) > 0) return false
  return line.split(' ').length <= 2
}

function isDishName(line) {
  if (!line || line.length < 3 || line.length > 72) return false
  const visible = line.replace(/\([^)]*\)/g, ' ')
  if (numberCount(visible) > 0) return false
  if (/^(add|with|served|choice|includes|oz|btl)\b/i.test(visible)) return false
  if (/^(small|medium|large|individual|family|bowl|cup)$/i.test(visible.trim())) return false
  const letters = visible.replace(/[^A-Za-z]/g, '')
  if (letters.length < 3) return false
  const upper = letters.replace(/[^A-Z]/g, '').length
  return upper / letters.length >= 0.6
}

function linePrice(line) {
  return priceAmount(/^\*+$/.test(line) ? '' : line.match(/^\$?\d{1,3}(?:\.\d{2})?$/)?.[0])
}

const NAME_AND_PRICE = /^([A-Za-z][A-Za-z0-9&'’.+\-() ]{1,72}?)\s+\*{0,2}\s*\$?(\d{1,3}(?:\.\d{2})?)$/

function pricedDish(line) {
  if (!/^[A-Za-z]/.test(line)) return null
  if (/upon request|corkage|split fee|dessert fee|^add\b/i.test(line)) return null
  const match = line.match(/^(.*?)\s+\$(\d{1,3}(?:\.\d{2})?)\b(.*)$/)
  if (!match) return null
  const name = match[1]
    .replace(/\s+(small|full|family|bowl|individual|cup)\s*\|?\s*$/i, '')
    .replace(/[*\s]+$/g, '')
    .trim()
  if (!isDishName(name)) return null
  const rest = match[3] || ''
  const multiple = /\$\d/.test(rest)
  return {
    name,
    price: multiple ? null : priceAmount(match[2]),
    note: multiple ? `$${match[2]}${rest}`.replace(/\s+/g, ' ').trim() : ''
  }
}

export function parseMenuText(text) {
  const lines = cleanLines(text)
  const items = []
  const seen = new Set()
  let category = null
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (isSectionHeader(line) && !NAME_AND_PRICE.test(line)) {
      category = line
      index += 1
      continue
    }
    let name = null
    let price = null
    let note = ''
    const dollars = pricedDish(line)
    const sameLine = line.match(NAME_AND_PRICE)
    if (dollars) {
      name = dollars.name
      price = dollars.price
      note = dollars.note
      index += 1
    } else if (sameLine && numberCount(line) === 1 && isDishName(sameLine[1].trim())) {
      name = sameLine[1].trim()
      price = priceAmount(sameLine[2])
      index += 1
    } else if (isDishName(line)) {
      let cursor = index + 1
      if (lines[cursor] === '*') cursor += 1
      const nextPrice = linePrice(lines[cursor] || '')
      if (nextPrice == null) {
        index += 1
        continue
      }
      name = line
      price = nextPrice
      index = cursor + 1
    } else {
      index += 1
      continue
    }
    const description = []
    while (index < lines.length && description.length < 3) {
      const next = lines[index]
      if (isSectionHeader(next) || pricedDish(next) || NAME_AND_PRICE.test(next) || isDishName(next) || linePrice(next) != null || next === '*') break
      description.push(next)
      index += 1
    }
    if (/upon request|corkage|split fee|dessert fee|additional charge/i.test(`${name} ${note}`)) {
      continue
    }
    pushItem(items, seen, {
      name,
      description: [note, ...description].filter(Boolean).join(' '),
      category,
      price
    })
  }
  return items
}

export function menuLinksFromHtml(html, baseUrl) {
  const links = []
  const seen = new Set()
  const pattern = /href\s*=\s*["']([^"']+)["']/gi
  let match = pattern.exec(String(html || ''))
  while (match) {
    let absolute = ''
    try {
      absolute = new URL(match[1], baseUrl).href.split('#')[0]
    } catch {
      absolute = ''
    }
    const lower = absolute.toLowerCase()
    const blocked = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com', 'maps.google.', 'google.com/maps']
    const useful = lower.endsWith('.pdf') || lower.includes('/menu') || lower.includes('menu.') || lower.includes('menus')
    if (absolute && /^https?:/i.test(absolute) && useful && !blocked.some((host) => lower.includes(host)) && !seen.has(absolute)) {
      seen.add(absolute)
      links.push(absolute)
    }
    match = pattern.exec(String(html || ''))
  }
  return links.slice(0, 6)
}
