import test from 'node:test'
import assert from 'node:assert/strict'
import { createSign, generateKeyPairSync } from 'crypto'
import { verifyAppleIdToken, verifyGoogleIdToken } from './oauthProviders.js'

test('Google sign-in accepts a verified token for the configured client and rejects a mismatched audience', async () => {
  const payload = {
    aud: 'web-client.apps.googleusercontent.com',
    email: 'Ada@Example.com',
    email_verified: 'true',
    sub: 'google-subject',
    exp: '2000',
    name: 'Ada'
  }
  const fetchImpl = async () => ({ ok: true, json: async () => payload })
  const ok = await verifyGoogleIdToken('header.payload.sig', {
    clientIds: 'web-client.apps.googleusercontent.com,ios-client.apps.googleusercontent.com',
    fetchImpl,
    now: () => 1_000_000
  })
  assert.equal(ok.ok, true)
  assert.equal(ok.email, 'ada@example.com')
  assert.equal(ok.sub, 'google-subject')

  const rejected = await verifyGoogleIdToken('header.payload.sig', {
    clientIds: 'other-client.apps.googleusercontent.com',
    fetchImpl,
    now: () => 1_000_000
  })
  assert.equal(rejected.ok, false)
})

test('Apple sign-in checks the signature, issuer, and client id', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = publicKey.export({ format: 'jwk' })
  jwk.kid = 'test-key'
  jwk.alg = 'RS256'
  jwk.use = 'sig'
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url')
  const body = Buffer.from(JSON.stringify({
    iss: 'https://appleid.apple.com',
    aud: 'com.tastetrails.app',
    sub: 'apple-subject',
    email: 'ada@privaterelay.appleid.com',
    exp: 2_000
  })).toString('base64url')
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${body}`)
  signer.end()
  const token = `${header}.${body}.${signer.sign(privateKey).toString('base64url')}`
  const fetchImpl = async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })
  const ok = await verifyAppleIdToken(token, {
    clientIds: ['com.tastetrails.web', 'com.tastetrails.app'],
    fetchImpl,
    now: () => 1_000_000
  })
  assert.equal(ok.ok, true)
  assert.equal(ok.sub, 'apple-subject')

  const wrong = await verifyAppleIdToken(token, {
    clientIds: 'com.someone.else',
    fetchImpl,
    now: () => 1_000_000
  })
  assert.equal(wrong.ok, false)
})
