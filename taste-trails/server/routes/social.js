import express from 'express'
import { resolveAuth } from './auth.js'
import { getSocialGraph } from '../../src/services/socialGraph.js'

const router = express.Router()

function send(res, result) {
  return res.status(result.status).json(result.body)
}

async function viewerFrom(req, res, { required = false } = {}) {
  const header = String(req.headers.authorization || '')
  if (!header) {
    if (required) {
      res.status(401).json({ error: 'Sign in required' })
      return null
    }
    return { id: null }
  }
  const auth = await resolveAuth(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message })
    return null
  }
  return auth.profile
}

router.get('/users/search', async (req, res) => {
  const viewer = await viewerFrom(req, res)
  if (!viewer) return
  return res.json({ users: getSocialGraph().search(viewer.id, req.query.q) })
})

router.get('/search', async (req, res) => {
  const viewer = await viewerFrom(req, res)
  if (!viewer) return
  return res.json({
    users: getSocialGraph().search(viewer.id, req.query.q),
    restaurants: [],
    dishes: []
  })
})

router.get('/users/:id/profile', async (req, res) => {
  const viewer = await viewerFrom(req, res)
  if (!viewer) return
  return send(res, getSocialGraph().profile(viewer.id, req.params.id))
})

router.get('/users/:id/posts', async (req, res) => {
  const viewer = await viewerFrom(req, res)
  if (!viewer) return
  return send(res, getSocialGraph().contentFor(viewer.id, req.params.id, 'posts'))
})

router.get('/users/:id/ratings', async (req, res) => {
  const viewer = await viewerFrom(req, res)
  if (!viewer) return
  return send(res, getSocialGraph().contentFor(viewer.id, req.params.id, 'ratings'))
})

router.get('/users/:id/lists', async (req, res) => {
  const viewer = await viewerFrom(req, res)
  if (!viewer) return
  return send(res, getSocialGraph().contentFor(viewer.id, req.params.id, 'lists'))
})

router.get('/users/:id/activity', async (req, res) => {
  const viewer = await viewerFrom(req, res)
  if (!viewer) return
  return send(res, getSocialGraph().contentFor(viewer.id, req.params.id, 'activity'))
})

router.get('/users/:id/saved-items', async (req, res) => {
  const viewer = await viewerFrom(req, res)
  if (!viewer) return
  return send(res, getSocialGraph().contentFor(viewer.id, req.params.id, 'lists'))
})

router.get('/users/:id/followers', async (req, res) => {
  const viewer = await viewerFrom(req, res)
  if (!viewer) return
  return send(res, getSocialGraph().connections(viewer.id, req.params.id, 'followers'))
})

router.get('/users/:id/following', async (req, res) => {
  const viewer = await viewerFrom(req, res)
  if (!viewer) return
  return send(res, getSocialGraph().connections(viewer.id, req.params.id, 'following'))
})

router.post('/users/:id/follow', async (req, res) => {
  const viewer = await viewerFrom(req, res, { required: true })
  if (!viewer) return
  return send(res, getSocialGraph().follow(viewer.id, req.params.id))
})

router.delete('/users/:id/follow', async (req, res) => {
  const viewer = await viewerFrom(req, res, { required: true })
  if (!viewer) return
  return send(res, getSocialGraph().unfollow(viewer.id, req.params.id))
})

router.delete('/users/:id/followers/:followerId', async (req, res) => {
  const viewer = await viewerFrom(req, res, { required: true })
  if (!viewer) return
  if (viewer.id !== req.params.id) return res.status(403).json({ error: 'You can only remove your own followers' })
  return send(res, getSocialGraph().removeFollower(viewer.id, req.params.followerId))
})

router.post('/users/:id/block', async (req, res) => {
  const viewer = await viewerFrom(req, res, { required: true })
  if (!viewer) return
  return send(res, getSocialGraph().block(viewer.id, req.params.id))
})

router.post('/users/:id/report', async (req, res) => {
  const viewer = await viewerFrom(req, res, { required: true })
  if (!viewer) return
  return send(res, getSocialGraph().report(viewer.id, req.params.id, req.body?.reason))
})

router.get(['/follow-requests', '/follow-requests/incoming'], async (req, res) => {
  const viewer = await viewerFrom(req, res, { required: true })
  if (!viewer) return
  return send(res, getSocialGraph().incoming(viewer.id))
})

async function decide(req, res, action) {
  const viewer = await viewerFrom(req, res, { required: true })
  if (!viewer) return
  return send(res, getSocialGraph().respond(viewer.id, req.params.id, action))
}

router.put('/follow-requests/:id/accept', (req, res) => decide(req, res, 'accept'))
router.post('/follow-requests/:id/accept', (req, res) => decide(req, res, 'accept'))
router.put('/follow-requests/:id/decline', (req, res) => decide(req, res, 'decline'))
router.post('/follow-requests/:id/decline', (req, res) => decide(req, res, 'decline'))

router.get('/feed', async (req, res) => {
  const viewer = await viewerFrom(req, res, { required: true })
  if (!viewer) return
  return send(res, getSocialGraph().feed(viewer.id))
})

router.post('/posts', async (req, res) => {
  const viewer = await viewerFrom(req, res, { required: true })
  if (!viewer) return
  return send(res, getSocialGraph().addPost(viewer.id, req.body || {}))
})

router.delete('/posts', async (req, res) => {
  const viewer = await viewerFrom(req, res, { required: true })
  if (!viewer) return
  return send(res, getSocialGraph().clearOwn(viewer.id))
})

router.get('/posts', async (req, res) => {
  const viewer = await viewerFrom(req, res)
  if (!viewer) return
  if (req.query.userId) return send(res, getSocialGraph().contentFor(viewer.id, String(req.query.userId), 'posts'))
  if (!viewer.id) return res.status(401).json({ error: 'Sign in required' })
  return send(res, getSocialGraph().feed(viewer.id))
})

router.post('/ratings', async (req, res) => {
  const viewer = await viewerFrom(req, res, { required: true })
  if (!viewer) return
  return send(res, getSocialGraph().addRating(viewer.id, req.body || {}))
})

router.get('/ratings', async (req, res) => {
  const viewer = await viewerFrom(req, res)
  if (!viewer) return
  return send(res, getSocialGraph().listRatings(viewer.id, {
    userId: req.query.userId ? String(req.query.userId) : null,
    dishId: req.query.dishId || req.query.dish_id || null
  }))
})

router.post('/lists', async (req, res) => {
  const viewer = await viewerFrom(req, res, { required: true })
  if (!viewer) return
  return send(res, getSocialGraph().addList(viewer.id, req.body || {}))
})

router.get('/saved-items', async (req, res) => {
  const viewer = await viewerFrom(req, res)
  if (!viewer) return
  const userId = req.query.userId ? String(req.query.userId) : viewer.id
  if (!userId) return res.status(401).json({ error: 'Sign in required' })
  return send(res, getSocialGraph().contentFor(viewer.id, userId, 'lists'))
})

export default router
