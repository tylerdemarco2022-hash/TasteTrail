import express from 'express';
import { supabase } from '../../backend/supabase.js';

const router = express.Router();

const checkAdminToken = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  const expected = process.env.ADMIN_TOKEN || 'dev-token-change-me';
  if (token !== expected) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// GET /admin/menu-items/restaurant/:restaurantId — list items for a restaurant
router.get('/restaurant/:restaurantId', checkAdminToken, async (req, res) => {
  const { restaurantId } = req.params;
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, name, description, price, section_name, category, photo_url, menu_type, created_at')
      .eq('restaurant_id', restaurantId)
      .order('section_name', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ items: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/menu-items/restaurant/:restaurantId — add a new menu item
router.post('/restaurant/:restaurantId', checkAdminToken, async (req, res) => {
  const { restaurantId } = req.params;
  const { name, description, price, section_name, category } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        restaurant_id: restaurantId,
        name: name.trim(),
        description: description?.trim() || null,
        price: price ? parseFloat(price) : null,
        section_name: section_name?.trim() || null,
        category: category?.trim() || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    console.log(`[Admin] Menu item added: ${name} → restaurant ${restaurantId}`);
    res.json({ success: true, item: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /admin/menu-items/:itemId — update a menu item
router.put('/:itemId', checkAdminToken, async (req, res) => {
  const { itemId } = req.params;

  try {
    const { name, description, price, section_name, category } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (price !== undefined) updates.price = price ? parseFloat(price) : null;
    if (section_name !== undefined) updates.section_name = section_name?.trim() || null;
    if (category !== undefined) updates.category = category?.trim() || null;

    const { data, error } = await supabase
      .from('menu_items')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    console.log(`[Admin] Menu item ${itemId} updated`);
    res.json({ success: true, item: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/menu-items/:itemId — remove a menu item
router.delete('/:itemId', checkAdminToken, async (req, res) => {
  const { itemId } = req.params;
  try {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', itemId);

    if (error) return res.status(500).json({ error: error.message });
    console.log(`[Admin] Menu item ${itemId} deleted`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
