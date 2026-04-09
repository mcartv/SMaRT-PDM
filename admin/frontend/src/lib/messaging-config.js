const trimTrailingSlash = (value, fallback) => {
  const resolved = String(value || fallback || '').trim()

  return resolved.endsWith('/') ? resolved.slice(0, -1) : resolved
}

export const MESSAGING_API_BASE = trimTrailingSlash(
  import.meta.env.VITE_MESSAGING_API_BASE_URL,
  'http://localhost:3000'
)

export const MESSAGING_SOCKET_BASE = trimTrailingSlash(
  import.meta.env.VITE_MESSAGING_SOCKET_URL,
  MESSAGING_API_BASE
)

export function getAdminMessagingToken() {
  return localStorage.getItem('adminToken') || ''
}

export function buildMessagingHeaders(token, { json = false } = {}) {
  const headers = {}

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (json) {
    headers['Content-Type'] = 'application/json'
  }

  return headers
}

export function parseMessagingToken(token) {
  if (!token) {
    return {}
  }

  try {
    const [, payload = ''] = token.split('.')
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
    const paddedPayload =
      normalizedPayload + '='.repeat((4 - (normalizedPayload.length % 4 || 4)) % 4)
    const decodedPayload = atob(paddedPayload)
    return JSON.parse(decodedPayload)
  } catch {
    return {}
  }
}
