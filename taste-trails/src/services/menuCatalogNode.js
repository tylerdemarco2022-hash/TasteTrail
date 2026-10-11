import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { assembleCatalog } from './menuItemFinder.js'
import { RESTAURANT_META, SEED_MENUS } from './restaurantMeta.js'

const menusDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../menus')

let cached = null

export function loadMenusFromDir(dir = menusDir) {
  const menusByName = {}
  for (const meta of RESTAURANT_META) {
    if (!meta.file) continue
    const filePath = path.join(dir, meta.file)
    if (!fs.existsSync(filePath)) continue
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      if (!Array.isArray(raw) || raw.length === 0) continue
      menusByName[meta.name] = raw
    } catch {
      continue
    }
  }
  return menusByName
}

export function getNodeMenuCatalog(dir = menusDir, { includeSeeds = false } = {}) {
  if (cached && dir === menusDir && !includeSeeds) return cached
  const catalog = assembleCatalog({
    menusByName: loadMenusFromDir(dir),
    meta: RESTAURANT_META,
    seeds: includeSeeds ? SEED_MENUS : []
  })
  if (dir === menusDir && !includeSeeds) cached = catalog
  return catalog
}
