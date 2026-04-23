import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * AsyncStorage wrapper with the same synchronous-style API as localStorage.
 * Note: All methods are async — await them or use .then().
 */
export const storage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, String(value)),
  removeItem: (key) => AsyncStorage.removeItem(key),
  clear: () => AsyncStorage.clear(),
}

/**
 * Helper: get a parsed JSON value (returns null on miss or parse error).
 */
export async function getJSON(key) {
  try {
    const raw = await AsyncStorage.getItem(key)
    if (raw == null) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Helper: set a JSON value.
 */
export async function setJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch {}
}
