async function nativePreferences() {
  const capacitor = globalThis.Capacitor
  if (!capacitor?.isNativePlatform?.()) return null
  try {
    const module = await import('@capacitor/preferences')
    return module.Preferences
  } catch {
    return null
  }
}

export async function readSessionValue(key) {
  const preferences = await nativePreferences()
  if (preferences) {
    const stored = await preferences.get({ key })
    return stored?.value || null
  }
  return localStorage.getItem(key)
}

export async function writeSessionValue(key, value) {
  const preferences = await nativePreferences()
  if (preferences) {
    await preferences.set({ key, value: String(value) })
    return
  }
  localStorage.setItem(key, String(value))
}

export async function removeSessionValue(key) {
  const preferences = await nativePreferences()
  if (preferences) {
    await preferences.remove({ key })
    return
  }
  localStorage.removeItem(key)
}
