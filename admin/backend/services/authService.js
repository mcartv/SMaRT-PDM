import { buildApiUrl } from '@/api';

async function parseJsonResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || fallbackMessage);
  }

  return data;
}

export const authService = {
  login: async (email, password, rememberMe) => {
    try {
      const response = await fetch(buildApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      return await parseJsonResponse(response, 'Invalid credentials');
    } catch (error) {
      console.error('Auth Service Error:', error);
      throw error;
    }
  },

  startAdminPasswordReset: async (email) => {
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

  verifyAdminPasswordResetOtp: async (email, otp) => {
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

  resetAdminPassword: async (email, resetToken, newPassword) => {
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

  logout: () => {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminProfile');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminProfile');

    window.location.href = '/admin/login';
  },
};