import crypto from 'crypto'
import { readJSON, writeJSON } from '../../backend/utils/localDB.js'

const ACCESS_TTL_MS = 30 * 24 * 60 * 60 * 1000
const REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000

function emptyStore() {
  return { access: {}, refresh: {} }
}

function normalize(raw) {
  if (!raw || Array.isArray(raw) || typeof raw !== 'object') return emptyStore()
  return {
    access: raw.access && typeof raw.access === 'object' && !Array.isArray(raw.access) ? raw.access : {},
    refresh: raw.refresh && typeof raw.refresh === 'object' && !Array.isArray(raw.refresh) ? raw.refresh : {}
  }
}

export function createSessionStore({
  read,
  write,
  now = () => Date.now(),
  random = () => crypto.randomBytes(32).toString('hex')
} = {}) {
  function load() {
    return normalize(read?.())
  }

  function issue(userId) {
    const data = load()
    const token = random()
    const refreshToken = random()
    const expiresAt = now() + ACCESS_TTL_MS
    data.access[token] = { userId, expiresAt, refreshToken }
    data.refresh[refreshToken] = { userId, expiresAt: now() + REFRESH_TTL_MS, accessToken: token }
    write?.(data)
    return { token, refreshToken, expiresAt }
  }

  function readAccess(token) {
    if (!token) return null
    const data = load()
    const row = data.access[token]
    if (!row) return null
    if (row.expiresAt <= now()) {
      delete data.access[token]
      write?.(data)
      return null
    }
    return row
  }

  function refresh(refreshToken) {
    const data = load()
    const row = data.refresh[refreshToken]
    if (!row || row.expiresAt <= now()) return null
    if (row.accessToken) delete data.access[row.accessToken]
    const token = random()
    const expiresAt = now() + ACCESS_TTL_MS
    data.access[token] = { userId: row.userId, expiresAt, refreshToken }
    row.accessToken = token
    row.expiresAt = now() + REFRESH_TTL_MS
    write?.(data)
    return { token, refreshToken, expiresAt, userId: row.userId }
  }

  function revoke(token) {
    const data = load()
    const row = data.access[token]
    if (row?.refreshToken) delete data.refresh[row.refreshToken]
    delete data.access[token]
    write?.(data)
  }

  function purgeUser(userId) {
    const data = load()
    for (const [token, row] of Object.entries(data.access)) {
      if (row.userId === userId) delete data.access[token]
    }
    for (const [token, row] of Object.entries(data.refresh)) {
      if (row.userId === userId) delete data.refresh[token]
    }
    write?.(data)
  }

  return { issue, readAccess, refresh, revoke, purgeUser }
}

let singleton = null

export function getSessionStore() {
  if (!singleton) {
    singleton = createSessionStore({
      read: () => readJSON('sessions.json'),
      write: (data) => writeJSON('sessions.json', data)
    })
  }
  return singleton
}
