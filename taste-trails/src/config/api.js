const configured = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '').trim()
const rawBaseUrl = configured || (import.meta.env.DEV ? 'http://localhost:8081' : '')

export const API_BASE_URL = rawBaseUrl.replace(/\/$/, '')
