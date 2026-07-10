import { buildApiUrl } from '@/api';

const AUTH_STORAGE_KEYS = [
  'adminToken',
  'adminProfile',
  'pdToken',
  'pdProfile',
  'guidanceToken',
  'guidanceProfile',
  'sdoToken',
  'sdoProfile',
];

const OFFICIAL_ADMIN_EMAIL = 'smartpdm.system@gmail.com';

async function parseJsonResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || fallbackMessage);
  }

  return data;
}

function clearAuthStorage() {
  AUTH_STORAGE_KEYS.forEach((key) => {
    sessionStorage.removeItem(key);

    // Keep this only to clean old remembered-login leftovers.
    localStorage.removeItem(key);
  });
}

export const authService = {
  login: async (email, password) => {
    const response = await fetch(buildApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    return await parseJsonResponse(response, 'Invalid credentials');
  },

  startAdminPasswordReset: async (email = OFFICIAL_ADMIN_EMAIL) => {
    const response = await fetch(
      buildApiUrl('/api/auth/admin/forgot-password/start'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }
    );

    return await parseJsonResponse(response, 'Unable to send recovery code');
  },

  verifyAdminPasswordResetOtp: async (otp, email = OFFICIAL_ADMIN_EMAIL) => {
    const response = await fetch(
      buildApiUrl('/api/auth/admin/forgot-password/verify'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      }
    );

    return await parseJsonResponse(response, 'Invalid or expired recovery code');
  },

  resetAdminPassword: async (resetToken, newPassword, email = OFFICIAL_ADMIN_EMAIL) => {
    const response = await fetch(
      buildApiUrl('/api/auth/admin/forgot-password/reset'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, resetToken, newPassword }),
      }
    );

    return await parseJsonResponse(response, 'Unable to reset password');
  },

  clearAuthStorage,

  logout: () => {
    clearAuthStorage();
    window.location.href = '/admin/login';
  },
};