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
    websites: ['https://www.131-main.com/menus/dinner-fall/', 'https://www.131-main.com/southpark/']
  },
  "Mama Ricotta's": {
    menuUrls: ['https://www.mamaricottas.com/site/wp-content/uploads/2023/07/Mamas-New-Dinner-Menu-June-2023.pdf'],
    websites: ['https://www.mamaricottas.com/menus/']
  },
  "Angeline's": {
    menuUrls: ['https://places.singleplatform.com/angelines/menu'],
    websites: ['https://www.angelinescharlotte.com/menus']
  },
  'Fahrenheit Charlotte': {
    websites: ['https://fahrenheitrestaurants.com/charlotte-menu/']
  },
  Postino: {
    menuUrls: ['https://assets.ctfassets.net/wguhd2dxl74h/2oi9YmElagw3E8cgXOZHaW/4e077643c77c29a84552e3016f4b5818/P10_NC_Culinary_10.08.26.pdf'],
    websites: ['https://www.postino.com/locations/postino-plaza-midwood']
  },
  'Supper Land': {
    menuUrls: ['https://supper.land/wp-content/uploads/11-x-17-size-menu-GENERIC-SPECIALS-1.pdf'],
    websites: ['https://supper.land/menu/']
  },
  'The Crunkleton': {
    menuUrls: ['https://thecrunkleton.com/locations/charlotte/menus/dinner-menu-charlotte/'],
    websites: ['https://thecrunkleton.com/locations/charlotte/']
  },
  'Restaurant Constance': {
    menuUrls: ['https://restaurantconstance.com/food-menu'],
    websites: ['https://restaurantconstance.com/']
  },
  'Stir Charlotte': {
    menuUrls: ['https://places.singleplatform.com/stir-charlotte/menu'],
    websites: ['https://www.stircharlotte.com/menus']
  },
  "Dean's Steakhouse": {
    menuUrls: ['https://places.singleplatform.com/deans-italian-steakhouse/menu'],
    websites: ['https://www.deanssteakhousecharlotte.com/menus/dinner']
  },
  "Chili's": {
    menuUrls: ['https://www.chilis.com/menu'],
    websites: ['https://www.chilis.com/locations/us/north-carolina/charlotte/tyvola']
  },
  Figtree: {
    menuUrls: [
      'https://charlottefigtree.com/wp-content/uploads/2026/10/9.20.26-Dinner-Menu.pdf',
      'https://charlottefigtree.com/wp-content/uploads/2026/10/9.30.26-Dessert-Menu.pdf'
    ],
    websites: ['https://charlottefigtree.com/menu/']
  },
  'La Belle Helene': {
    menuUrls: [
      'https://www.labellehelenerestaurant.com/menu/dinner/',
      'https://www.labellehelenerestaurant.com/menu/lunch/'
    ],
    websites: ['https://www.labellehelenerestaurant.com/']
  },
  'Sea Grill Diner': {
    menuUrls: ['https://www.seagrillnc.com/_files/ugd/3e8ab8_edc6bd5448294802906373705c0d28f9.pdf'],
    websites: ['https://www.seagrillnc.com/menu']
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
