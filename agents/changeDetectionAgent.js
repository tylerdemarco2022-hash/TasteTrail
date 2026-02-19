const supabase = require('../services/supabaseClient');
const logger = require('../services/logger');

function indexItems(items) {
  const map = new Map();
  for (const it of items || []) {
    const key = (it.name || '').toLowerCase().trim();
    map.set(key, it);
  }
  return map;
}

async function changeDetectionAgent(restaurantId, newMenu) {
  try {
    const { data: storedMenus, error } = await supabase.from('menu_items').select('id,name,price,menu_section').eq('restaurant_id', restaurantId);
    if (error) throw error;
    const oldItems = storedMenus || [];
    const oldIndex = indexItems(oldItems);

    const added = [];
    const removed = [];
    const price_changes = [];

    for (const section of newMenu.menu_sections || []) {
      for (const it of section.items || []) {
        const key = (it.name || '').toLowerCase().trim();
        if (!oldIndex.has(key)) added.push({ ...it, section: section.section });
        else {
          const old = oldIndex.get(key);
          if (old.price != it.price) price_changes.push({ before: old.price, after: it.price, name: it.name });
          oldIndex.delete(key);
        }
      }
    }

    // anything left in oldIndex was removed
    for (const [k, v] of oldIndex) removed.push(v);

    // persist change logs
    const logs = [];
    for (const a of added) logs.push({ restaurant_id: restaurantId, type: 'added', payload: a });
    for (const r of removed) logs.push({ restaurant_id: restaurantId, type: 'removed', payload: r });
    for (const p of price_changes) logs.push({ restaurant_id: restaurantId, type: 'price_change', payload: p });

    if (logs.length) {
      const { error: errInsert } = await supabase.from('menu_change_log').insert(logs.map(l => ({ restaurant_id: l.restaurant_id, change_type: l.type, payload: l.payload })));
      if (errInsert) logger.error('Failed to insert change logs: %s', errInsert.message);
    }

    return { added, removed, price_changes };
  } catch (err) {
    logger.error('changeDetectionAgent error: %s', err.message);
    return { added: [], removed: [], price_changes: [] };
  }
}

module.exports = changeDetectionAgent;
