import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionStore } from './sessionStore.js'

test('a session survives a new store reading the same file and refresh replaces the access token', () => {
  let saved = null
  const store = createSessionStore({
    read: () => saved,
    write: (data) => { saved = data },
    now: () => 1_000,
    random: (() => {
      let n = 0
      return () => `tok-${++n}`
    })()
  })
  const issued = store.issue('user-1')
  assert.equal(issued.token, 'tok-1')
  assert.equal(issued.refreshToken, 'tok-2')

  const reopened = createSessionStore({
    read: () => saved,
    write: (data) => { saved = data },
    now: () => 1_000,
    random: () => 'tok-3'
  })
  assert.equal(reopened.readAccess(issued.token).userId, 'user-1')
  const next = reopened.refresh(issued.refreshToken)
  assert.equal(next.token, 'tok-3')
  assert.equal(next.userId, 'user-1')
  assert.equal(reopened.readAccess(issued.token), null)
  assert.equal(reopened.readAccess(next.token).userId, 'user-1')

  reopened.purgeUser('user-1')
  assert.equal(reopened.readAccess(next.token), null)
  assert.equal(reopened.refresh(issued.refreshToken), null)
})
