import { createPublicKey, createVerify } from 'crypto'

function allowedIds(clientIds) {
  return (Array.isArray(clientIds) ? clientIds : String(clientIds || '').split(','))
    .map((id) => id.trim())
    .filter(Boolean)
}

function decodePart(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
}

export async function verifyGoogleIdToken(idToken, { clientIds, fetchImpl = fetch, now = () => Date.now() } = {}) {
  const allowed = allowedIds(clientIds)
  if (!idToken || !allowed.length) return { ok: false, error: 'Google sign-in is not configured' }
  const response = await fetchImpl(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`)
  if (!response?.ok) return { ok: false, error: 'Google token was rejected' }
  const payload = await response.json()
  const expiresAt = Number(payload.exp) * 1000
  if (!allowed.includes(payload.aud)) return { ok: false, error: 'Google token audience does not match' }
  if (String(payload.email_verified) !== 'true') return { ok: false, error: 'Google email is not verified' }
  if (!payload.sub || !payload.email || !(expiresAt > now())) return { ok: false, error: 'Google token is invalid' }
  return { ok: true, sub: String(payload.sub), email: String(payload.email).toLowerCase(), name: payload.name || '' }
}

export function verifyRs256(token, jwk) {
  const [header, payload, signature] = String(token || '').split('.')
  if (!header || !payload || !signature) return false
  const key = createPublicKey({ key: jwk, format: 'jwk' })
  const verifier = createVerify('RSA-SHA256')
  verifier.update(`${header}.${payload}`)
  verifier.end()
  return verifier.verify(key, Buffer.from(signature, 'base64url'))
}

export async function verifyAppleIdToken(idToken, { clientIds, fetchImpl = fetch, now = () => Date.now() } = {}) {
  const allowed = allowedIds(clientIds)
  if (!idToken || !allowed.length) return { ok: false, error: 'Apple sign-in is not configured' }
  const parts = String(idToken).split('.')
  if (parts.length !== 3) return { ok: false, error: 'Apple token is invalid' }
  let header
  let payload
  try {
    header = decodePart(parts[0])
    payload = decodePart(parts[1])
  } catch {
    return { ok: false, error: 'Apple token is invalid' }
  }
  if (header.alg !== 'RS256' || !header.kid) return { ok: false, error: 'Apple token is invalid' }
  if (payload.iss !== 'https://appleid.apple.com') return { ok: false, error: 'Apple token issuer does not match' }
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!audiences.some((aud) => allowed.includes(aud))) return { ok: false, error: 'Apple token audience does not match' }
  if (!(Number(payload.exp) * 1000 > now()) || !payload.sub) return { ok: false, error: 'Apple token is invalid' }
  const keysResponse = await fetchImpl('https://appleid.apple.com/auth/keys')
  if (!keysResponse?.ok) return { ok: false, error: 'Apple keys could not be loaded' }
  const keys = await keysResponse.json()
  const jwk = (keys.keys || []).find((key) => key.kid === header.kid)
  if (!jwk || !verifyRs256(idToken, jwk)) return { ok: false, error: 'Apple token signature was rejected' }
  return { ok: true, sub: String(payload.sub), email: payload.email ? String(payload.email).toLowerCase() : '', name: '' }
}
