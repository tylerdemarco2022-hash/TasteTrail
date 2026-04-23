import express from 'express';
import { supabase } from '../../backend/supabase.js';

const router = express.Router();

const checkAdminToken = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  const expected = process.env.ADMIN_TOKEN || 'dev-token-change-me';
  if (token !== expected) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// GET /admin/users — list all users from DB
router.get('/', checkAdminToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, role, credibility_score, bot_score, ratings_count, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      // Fallback: users table has: id, email, credibility_score, trust_multiplier, bot_score, ratings_count, created_at
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, credibility_score, trust_multiplier, bot_score, ratings_count, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (usersError) return res.status(500).json({ error: usersError.message });
      return res.json({ users: users || [] });
    }

    res.json({ users: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /admin/users/:id — update user fields
// Supports: role (profiles only), credibility_score, bot_score, trust_multiplier
router.patch('/:id', checkAdminToken, async (req, res) => {
  const { id } = req.params;
  const { role, credibility_score, bot_score, trust_multiplier } = req.body;

  try {
    // Try profiles first (has role column)
    if (role !== undefined) {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (!error) {
        console.log(`[Admin] User ${id} role → ${role}`);
        return res.json({ success: true, user: data });
      }
    }

    // Update trust/credibility scores in users table
    const updates = {};
    if (credibility_score !== undefined) updates.credibility_score = Number(credibility_score);
    if (bot_score !== undefined) updates.bot_score = Number(bot_score);
    if (trust_multiplier !== undefined) updates.trust_multiplier = Number(trust_multiplier);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    console.log(`[Admin] User ${id} updated:`, updates);
    res.json({ success: true, user: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
