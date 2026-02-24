import express from 'express'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { readJSON, writeJSON } from '../utils/localDB.js'

const router = express.Router()

const sessions = {}

function generateToken() {
  return crypto.randomBytes(24).toString('hex')
}

router.post('/register', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing credentials' })
  }

  const users = readJSON('users.json')

  const exists = users.find(u => u.email === email)
  if (exists) {
    return res.status(400).json({ error: 'User already exists' })
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const newUser = {
    id: Date.now(),
    email,
    password: hashedPassword
  }

  users.push(newUser)
  writeJSON('users.json', users)

  const token = generateToken()
  sessions[token] = newUser.id

  return res.json({
    user: { id: newUser.id, email: newUser.email },
    token
  })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing credentials' })
  }

  const users = readJSON('users.json')
  const user = users.find(u => u.email === email)

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const valid = await bcrypt.compare(password, user.password)

  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = generateToken()
  sessions[token] = user.id

  return res.json({
    user: { id: user.id, email: user.email },
    token
  })
})

export function requireAuth(req, res, next) {
  const header = req.headers.authorization

  if (!header) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = header.split(' ')[1]

  if (!sessions[token]) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  req.userId = sessions[token]
  next()
}

export default router
