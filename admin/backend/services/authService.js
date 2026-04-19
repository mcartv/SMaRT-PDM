import { buildApiUrl } from '@/api';

const API_URL = buildApiUrl('/api/auth');

export const authService = {
  login: async (email, password, rememberMe) => {
    try {
      const response = await fetch(buildApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid credentials');
      }

      return data;
    } catch (error) {
      console.error('Auth Service Error:', error);
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminProfile');
    window.location.href = '/login';
  },
};