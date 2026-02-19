import express from 'express';
const router = express.Router();

// Simple stub for follow-requests used by the frontend.
// Returns an empty list (safe default) so frontend doesn't 404 while feature is unimplemented.
router.get('/follow-requests', async (req, res) => {
  try {
    res.json({ followRequests: [] });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

export default router;
