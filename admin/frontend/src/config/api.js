const configuredApiBaseUrl = String(import.meta.env.VITE_API_URL || '')
  .trim()
  .replace(/\/+$/, '');

const browserOrigin =
  typeof window !== 'undefined' ? window.location.origin : '';

const isLocalDevelopment =
  import.meta.env.DEV ||
  (typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname));

// Local development uses the Vite origin so /api requests are forwarded by
// vite.config.js to the local backend on port 5000. Production uses VITE_API_URL.
const API_BASE_URL = isLocalDevelopment
  ? browserOrigin
  : configuredApiBaseUrl || browserOrigin;

export const buildApiUrl = (path = '') => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};

export default API_BASE_URL;
