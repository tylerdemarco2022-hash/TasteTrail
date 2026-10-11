import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { RESTAURANT_META } from './restaurantMeta.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const DIRECT_SOURCES = {
  'Sixty Vines': {
    menuUrls: ['https://www.sixtyvines.com/menu/all/dinner'],
    websites: ['https://www.sixtyvines.com/']
  },
  'Culinary Dropout': {
    menuUrls: ['https://www.culinarydropout.com/wp-content/uploads/2025/06/CDO-CLT_Menu_Main_08.2026_MP_v3_WEB.pdf'],
    websites: ['https://www.culinarydropout.com/locations/charlotte-nc/']
  },
  '131 Main': {
    menuUrls: ['https://www.131-main.com/wp-content/uploads/2024/10/Dinner-fall-winter-2024.pdf'],
    websites: ['https://www.131-main.com/southpark/']
  },
  "Mama Ricotta's": {
    menuUrls: ['https://www.mamaricottas.com/site/wp-content/uploads/2023/07/Mamas-New-Dinner-Menu-June-2023.pdf'],
    websites: ['https://www.mamaricottas.com/menus/']
  },
  "Angeline's": {
    websites: ['https://www.angelinescharlotte.com/menus']
  },
  'Fahrenheit Charlotte': {
    websites: ['https://fahrenheitrestaurants.com/charlotte-menu/']
  },
  Postino: {
    websites: ['https://www.postino.com/']
  },
  'Supper Land': {
    websites: ['https://www.supperland.com/menu', 'https://www.supperland.com/']
  },
  'The Crunkleton': {
    websites: ['https://thecrunkleton.com/']
  },
  'Restaurant Constance': {
    websites: ['https://restaurantconstance.com/']
  },
  'Stir Charlotte': {
    websites: ['https://www.stircharlotte.com/']
  },
  "Dean's Steakhouse": {
    websites: ['https://www.deanssteakhouse.com/']
  },
  "Chili's": {
    websites: ['https://www.chilis.com/menu']
  },
  Figtree: {
    websites: []
  },
  'La Belle Helene': {
    websites: []
  },
  'Sea Grill Diner': {
    websites: []
  }
}

function loadDiscoveredWebsites() {
  try {
    const file = path.join(root, 'menu-urls-found.json')
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    const byName = {}
    for (const [name, entries] of Object.entries(parsed)) {
      byName[name] = (Array.isArray(entries) ? entries : [])
        .map((entry) => entry?.url)
        .filter((url) => typeof url === 'string' && /^https?:/i.test(url))
    }
    return byName
  } catch {
    return {}
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

export function knownRestaurantRecords() {
  const discovered = loadDiscoveredWebsites()
  return RESTAURANT_META.map((meta) => {
    const extra = DIRECT_SOURCES[meta.name] || {}
    const discoveredUrls = discovered[meta.name] || []
    return {
      name: meta.name,
      address: meta.address || null,
      latitude: meta.latitude ?? null,
      longitude: meta.longitude ?? null,
      approximate: Boolean(meta.approximate),
      menuUrls: unique(extra.menuUrls || []),
      websites: unique([...(extra.websites || []), ...discoveredUrls])
    }
  })
}

export function foldRestaurantName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
