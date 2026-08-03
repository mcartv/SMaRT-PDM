const API_BASE_URL =
  String(import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '') ||
  window.location.origin;

export const buildApiUrl = (path = '') => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};

export default API_BASE_URL;
