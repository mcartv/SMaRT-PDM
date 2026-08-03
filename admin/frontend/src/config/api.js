const API_BASE_URL =
  String(import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '') ||
  window.location.origin;

export const buildApiUrl = (path = '') => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};

export function installApiCredentials() {
  if (typeof window === 'undefined' || window.__smartPdmFetchInstalled) return;
  const nativeFetch = window.fetch.bind(window);
  const apiOrigin = new URL(API_BASE_URL, window.location.origin).origin;

  window.fetch = (input, init = {}) => {
    const requestUrl = new URL(
      typeof input === 'string' || input instanceof URL ? input : input.url,
      window.location.origin
    );
    const nextInit = requestUrl.origin === apiOrigin
      ? { ...init, credentials: init.credentials || 'include' }
      : init;
    return nativeFetch(input, nextInit);
  };
  window.__smartPdmFetchInstalled = true;
}

export default API_BASE_URL;
