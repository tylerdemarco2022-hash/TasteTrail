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

function priceAmount(value, limit = 900) {
  if (value == null || value === '') return null
  const match = String(value).replace(/,/g, '').match(/(\d{1,4}(?:\.\d{2})?)/)
  if (!match) return null
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount < 1 || amount > limit) return null
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

function readableName(name) {
  const compact = name.replace(/\s+/g, '')
  if (/potato/i.test(compact) && /wedge/i.test(compact) && (name.match(/\b[A-Za-z]\b/g) || []).length >= 4) {
    return 'Sweet Potato Wedges'
  }
  return name
}

function pushItem(items, seen, raw) {
  const name = readableName(decode(raw?.name))
  if (!name || name.length < 2 || name.length > 80) return
  if (!/[a-z]/i.test(name)) return
  if (/^(get|menu|home|about|contact|order|reservations?|privacy policy|gift cards?|careers?|locations?|login|sign in)$/i.test(name)) return
  const key = name.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  const description = decode(raw?.description)
  const category = decode(raw?.category) || null
  items.push({
    name,
    description: description || null,
    category: category && /^(get|menu|home|about|contact|order|careers?|locations?|login|sign in)$/i.test(category) ? null : category,
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
  if (types.includes('offercatalog')) {
    walkJsonLd(node.itemListElement, decode(node.name) || category, items, seen)
    return
  }
  if (types.includes('offer') && node.itemOffered && typeof node.itemOffered === 'object') {
    pushItem(items, seen, {
      name: node.itemOffered.name,
      description: node.itemOffered.description,
      category,
      price: priceAmount(node.price, 5000)
    })
    return
  }
  if (Array.isArray(node['@graph'])) walkJsonLd(node['@graph'], category, items, seen)
  if (node.hasMenuSection) walkJsonLd(node.hasMenuSection, category, items, seen)
  if (node.hasMenuItem) walkJsonLd(node.hasMenuItem, category, items, seen)
  if (node.hasOfferCatalog) walkJsonLd(node.hasOfferCatalog, category, items, seen)
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

function squarespaceItems(html, items, seen) {
  let category = null
  const pattern = /class="menu-section-title"[^>]*>([\s\S]*?)<\/div>|class="menu-item-title"[^>]*>([\s\S]*?)<\/div>\s*(?:<div class="menu-item-description"[^>]*>([\s\S]*?)<\/div>)?[\s\S]{0,500}?menu-item-price-bottom[\s\S]{0,240}?\$\s*(?:<[^>]+>\s*)*(\d{1,3}(?:\.\d{2})?)/gi
  let match = pattern.exec(html)
  while (match) {
    if (match[1]) category = decode(match[1])
    else {
      pushItem(items, seen, {
        name: decode(match[2]),
        description: decode(match[3]),
        category,
        price: priceAmount(match[4])
      })
    }
    match = pattern.exec(html)
  }
}

function oloItems(html, items, seen) {
  if (!String(html).includes('oloProductId')) return
  const decoded = String(html)
    .replace(/\\u0026/g, '&')
    .replace(/\\u00ae/g, '®')
    .replace(/\\u2019/g, "'")
    .replace(/\\"/g, '"')
  const pattern = /"name":"([^"]+)","oloProductId":\d+[\s\S]*?"categoryName":"([^"]*)"[\s\S]*?"isAvailable":(true|false)[\s\S]*?"displayCost":"([^"]*)"[\s\S]*?"calorieCount":"([^"]*)"/g
  let match = pattern.exec(decoded)
  while (match) {
    if (match[3] === 'true') {
      const display = match[4].trim()
      const calories = decode(match[5])
      pushItem(items, seen, {
        name: decode(match[1]),
        description: calories && !/^0 cal/i.test(calories) ? calories : null,
        category: decode(match[2]),
        price: display && display !== '0' ? priceAmount(display) : null
      })
    }
    match = pattern.exec(decoded)
  }
}

function htmlToMenuText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
}

export function parseMenuHtml(html) {
  const text = String(html || '')
  const items = []
  const seen = new Set()
  for (const block of jsonLdBlocks(text)) walkJsonLd(block, null, items, seen)
  squarespaceItems(text, items, seen)
  oloItems(text, items, seen)
  for (const name of htmlTitles(text)) pushItem(items, seen, { name })
  if (items.length < 3) {
    for (const item of parseMenuText(htmlToMenuText(text))) pushItem(items, seen, item)
  }
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

function headerWords(line) {
  return line.split(' ').filter((word) => word && word !== '&' && word !== '+')
}

function isDietaryMarker(line) {
  const words = String(line || '').toUpperCase().split(/\s+/).filter(Boolean)
  return words.length > 0 && words.every((word) => /^(GF|GFGF|GLUTEN|FREE|VEGETARIAN|VEGAN|SPICY|TOUCH)$/.test(word))
}

function isSectionHeader(line) {
  if (!SECTION_HEADER.test(line)) return false
  if (numberCount(line) > 0 || isDietaryMarker(line)) return false
  const words = headerWords(line)
  return words.length >= 1 && words.length <= 2
}

function dishCore(line) {
  return String(line || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d+\s*(?:oz|lbs?|g)\b/gi, ' ')
    .replace(/\d+\s*(?:oz|lbs?)\b/gi, ' ')
    .replace(/\*/g, ' ')
}

function repeatedWord(line) {
  const counts = {}
  for (const word of line.toUpperCase().split(/\s+/).filter((word) => word.length > 1)) {
    counts[word] = (counts[word] || 0) + 1
    if (counts[word] >= 3) return true
  }
  return false
}

function isTitleCaseDish(line) {
  if ((line.match(/,/g) || []).length > 1) return false
  if (/\b(with|served|topped|tossed|accompanied|including|finished|prepared|consuming|vinaigrette)\b/i.test(line)) return false
  const words = dishCore(line).replace(/,/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length < 1 || words.length > 8) return false
  const skip = /^(a|an|and|or|of|the|de|du|au|la|le|et|in|on|&)$/i
  const significant = words.filter((word) => !skip.test(word))
  if (!significant.length) return false
  const titled = significant.filter((word) => /^[A-Z0-9]/.test(word))
  return titled.length / significant.length >= 0.8
}

function isDishName(line) {
  if (!line || line.length < 3 || line.length > 80) return false
  if (repeatedWord(line)) return false
  if (/upon request|corkage|split fee|dessert fee|service charge|foodborne|tip the kitchen|consuming raw|these items contain|items are served raw|meant to be shared|your choice of/i.test(line)) return false
  if (isDietaryMarker(line)) return false
  if (/^(add|with|served|choice|includes|oz|btl)\b/i.test(line)) return false
  const visible = dishCore(line)
  if (numberCount(visible) > 0) return false
  if (/^(small|medium|large|individual|family|bowl|cup)$/i.test(visible.trim())) return false
  const letters = visible.replace(/[^A-Za-z]/g, '')
  if (letters.length < 3) return false
  const upper = letters.replace(/[^A-Z]/g, '').length
  if (upper / letters.length >= 0.6) return true
  return isTitleCaseDish(line)
}

function linePrice(line) {
  return priceAmount(/^\*+$/.test(line) ? '' : line.match(/^\$?\d{1,3}(?:\.\d{2})?$/)?.[0])
}

const NAME_AND_PRICE = /^([A-Za-z*][A-Za-z0-9&'’.+\-()* ,]{1,80}?)\s+\*{0,2}\s*\$?(\d{1,3}(?:\.\d{2})?)$/

function pricedDish(line) {
  const start = line.replace(/^\*+\s*/, '')
  if (!/^[A-Za-z]/.test(start)) return null
  if (/upon request|corkage|split fee|dessert fee|^add\b|service charge|foodborne/i.test(start)) return null
  const match = start.match(/^(.*?)\s+\$(\d{1,4}(?:\.\d{2})?)\b(.*)$/)
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

function sameLineDish(line) {
  const start = line.replace(/^\*+\s*/, '')
  if (/upon request|corkage|split fee|dessert fee|^add\b|service charge|foodborne/i.test(start)) return null
  const slash = start.match(/^(.*?)\s+(\d{1,3})\s*\/\s*(\d{1,3})$/)
  if (slash && isDishName(slash[1].trim())) {
    return { name: slash[1].trim(), price: null, note: `${slash[2]}/${slash[3]}` }
  }
  const market = start.match(/^(.*?)\s+((?:half dozen,?\s*)?market price)$/i)
  if (market && isDishName(market[1].trim())) {
    return { name: market[1].trim(), price: null, note: market[2] }
  }
  const piped = start.match(/^(.*?)\s+(\d{1,3}(?:\.\d{2})?)\s+\|\s+(.+)$/)
  if (piped && isDishName(piped[1].trim())) {
    return { name: piped[1].trim(), price: null, note: `${piped[2]} | ${piped[3]}` }
  }
  const match = start.match(/^(.*)\s+\$?(\d{1,3}(?:\.\d{2})?)\s*(?:each|ea)?$/i)
  if (!match) return null
  const name = match[1].replace(/\s+half dozen$/i, '').replace(/[*\s]+$/g, '').trim()
  if (!isDishName(name) || numberCount(line) > 4) return null
  return { name, price: priceAmount(match[2]), note: /half dozen/i.test(match[1]) ? 'half dozen' : '' }
}

function caloriePrice(line) {
  const split = line.match(/^(.*?)(?:^|\s)(\d[\d,]*(?:\s*-\s*\d[\d,]*)?)\s*cal\s+(\+)?(\d+\.\d)\s+(\d)\s*$/i)
  if (split) {
    if (split[3]) return null
    return { prefix: split[1].trim(), calories: split[2].replace(/\s+/g, ''), price: priceAmount(`${split[4]}${split[5]}`) }
  }
  const whole = line.match(/^(.*?)(?:^|\s)(\d[\d,]*(?:\s*-\s*\d[\d,]*)?)\s*cal\s+(\+)?(\d+(?:\.\d{1,2})?)\s*$/i)
  if (!whole || whole[3]) return null
  return { prefix: whole[1].trim(), calories: whole[2].replace(/\s+/g, ''), price: priceAmount(whole[4]) }
}

export function parseMenuText(text) {
  const lines = cleanLines(text)
  const items = []
  const seen = new Set()
  let category = null
  let pendingHeader = null
  let pendingNotes = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    const upcoming = lines[index + 1]
    const upcomingIsPrice = upcoming === '*' || linePrice(upcoming || '') != null
    const calories = caloriePrice(line)
    if (calories && /^\s*\+/.test(line)) {
      index += 1
      continue
    }
    if (calories && calories.price != null && pendingHeader) {
      const notes = [...pendingNotes, calories.prefix].filter(Boolean)
      if (calories.calories) notes.push(`${calories.calories} cal`)
      pushItem(items, seen, {
        name: pendingHeader,
        description: notes.join(' '),
        category,
        price: calories.price
      })
      pendingHeader = null
      pendingNotes = []
      index += 1
      const toppings = []
      while (isDishName(lines[index] || '') && isDishName(lines[index + 1] || '')) {
        toppings.push(lines[index])
        index += 1
      }
      if (toppings.length) {
        const last = items[items.length - 1]
        last.description = [last.description, toppings.join('; ')].filter(Boolean).join(' ')
      }
      continue
    }
    if (isSectionHeader(line) && !NAME_AND_PRICE.test(line) && !pricedDish(line) && !sameLineDish(line) && !upcomingIsPrice) {
      category = line
      pendingHeader = line
      pendingNotes = []
      index += 1
      continue
    }
    if (pendingHeader && !pricedDish(line) && !sameLineDish(line) && !isDishName(line)) {
      pendingNotes.push(line)
      index += 1
      continue
    }
    let name = null
    let price = null
    let note = ''
    const dollars = pricedDish(line)
    const sameLine = sameLineDish(line)
    if (dollars) {
      name = dollars.name
      price = dollars.price
      note = dollars.note
      index += 1
    } else if (sameLine) {
      name = sameLine.name
      price = sameLine.price
      note = sameLine.note
      index += 1
    } else if (isDishName(line)) {
      let cursor = index + 1
      if (lines[cursor] === '*') cursor += 1
      const nextPrice = linePrice(lines[cursor] || '')
      if (nextPrice == null) {
        pendingHeader = line.replace(/^\*+\s*/, '').trim()
        pendingNotes = []
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
      const after = lines[index + 1]
      const nextIsDish = pricedDish(next) || sameLineDish(next) || (isDishName(next) && (after === '*' || linePrice(after || '') != null))
      if (isSectionHeader(next) || nextIsDish || linePrice(next) != null || next === '*') break
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
