const logger = require('../services/logger');

function parsePrice(text) {
  if (!text) return null;
  const m = text.match(/\$?\s*(\d+\.?\d{0,2})/);
  if (m) return parseFloat(m[1]);
  return null;
}

function normalizeMenu(menu) {
  const sections = (menu.menu_sections || []).map(sec => {
    const items = (sec.items || []).map(it => {
      const name = (it.name || '').replace(/\s{2,}/g, ' ').trim();
      const price = it.price != null ? parsePrice(String(it.price)) : parsePrice(name);
      const description = (it.description || '').trim();
      return { name, description, price };
    });
    const deduped = [];
    const seen = new Set();
    for (const it of items) {
      const k = (it.name || '').toLowerCase();
      if (!seen.has(k)) { seen.add(k); deduped.push(it); }
    }
    return { section: sec.section, items: deduped };
  });
  return { menu_sections: sections };
}

module.exports = { normalizeMenu, parsePrice };
