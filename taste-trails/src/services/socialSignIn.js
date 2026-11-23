function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      if (existing.dataset.loaded === 'true') resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => reject(new Error('Sign-in could not be loaded'))
    document.head.appendChild(script)
  })
}

export async function requestProviderToken(provider) {
  if (provider === 'google') return requestGoogle()
  if (provider === 'apple') return requestApple()
  throw new Error('Unknown sign-in provider')
}

async function requestGoogle() {
  const native = globalThis.Capacitor?.Plugins?.GoogleAuth
  if (globalThis.Capacitor?.isNativePlatform?.() && native?.signIn) {
    const result = await native.signIn()
    const idToken = result?.authentication?.idToken || result?.idToken
    if (!idToken) throw new Error('Google did not return a token')
    return { idToken, name: result?.displayName || result?.name || '' }
  }
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('Google sign-in is not configured')
  await loadScript('https://accounts.google.com/gsi/client')
  return new Promise((resolve, reject) => {
    let settled = false
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        settled = true
        if (response?.credential) resolve({ idToken: response.credential, name: '' })
        else reject(new Error('Google sign-in was cancelled'))
      }
    })
    window.google.accounts.id.prompt((notification) => {
      if (settled) return
      if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
        reject(new Error('Google sign-in was cancelled'))
      }
    })
  })
}

async function requestApple() {
  const native = globalThis.Capacitor?.Plugins?.SignInWithApple
  if (globalThis.Capacitor?.isNativePlatform?.() && native?.authorize) {
    const result = await native.authorize({ scopes: 'email name' })
    const response = result?.response || result
    if (!response?.identityToken) throw new Error('Apple did not return a token')
    const given = response.givenName || response.fullName?.givenName || ''
    const family = response.familyName || response.fullName?.familyName || ''
    return { idToken: response.identityToken, name: `${given} ${family}`.trim() }
  }
  const clientId = import.meta.env.VITE_APPLE_CLIENT_ID
  const redirectURI = import.meta.env.VITE_APPLE_REDIRECT_URI
  if (!clientId || !redirectURI) throw new Error('Apple sign-in is not configured')
  await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js')
  window.AppleID.auth.init({ clientId, scope: 'name email', redirectURI, usePopup: true })
  const result = await window.AppleID.auth.signIn()
  const name = result?.user?.name
  return {
    idToken: result?.authorization?.id_token,
    name: name ? `${name.firstName || ''} ${name.lastName || ''}`.trim() : ''
  }
}
