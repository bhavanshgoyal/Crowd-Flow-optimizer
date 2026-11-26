const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export function apiUrl(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path
}

export function wsUrl(path: string): string {
  if (API_BASE) {
    const base = API_BASE.replace(/^http/i, 'ws')
    return `${base}${path}`
  }
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}${path}`
}
