import Constants from 'expo-constants'

const rawBaseUrl =
  Constants.expoConfig?.extra?.apiBaseUrl ||
  'http://localhost:8081'

export const API_BASE_URL = rawBaseUrl.replace(/\/$/, '')
