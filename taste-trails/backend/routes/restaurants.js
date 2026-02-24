import express from 'express'
import { readJSON, writeJSON } from '../utils/localDB.js'
import { requireAuth } from './auth.js'

const router = express.Router()

router.get('/', requireAuth, (req, res) => {
  const restaurants = readJSON('restaurants.json')
  return res.json({ restaurants })
})

router.post('/', requireAuth, (req, res) => {
  const { name, url } = req.body

  if (!name || !url) {
    return res.status(400).json({ error: 'Missing fields' })
  }

  const restaurants = readJSON('restaurants.json')

  const newRestaurant = {
    id: Date.now(),
    name,
    url,
    createdBy: req.userId
  }

  restaurants.push(newRestaurant)
  writeJSON('restaurants.json', restaurants)

  return res.json(newRestaurant)
})

export default router
