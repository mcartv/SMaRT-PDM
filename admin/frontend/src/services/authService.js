import { buildApiUrl } from '@/api';
import {
  PAGE_INSTANCE_ID,
  clearAuthStorage,
  getAdminDeviceId,
  getStoredPortalSession,
} from '@/utils/authStorage';

const OFFICIAL_ADMIN_EMAIL = 'smartpdm.system@gmail.com';

export class AuthRequestError extends Error {
  constructor(message, { status = 0, code = 'AUTH_REQUEST_ERROR' } = {}) {
    super(message);
    this.name = 'AuthRequestError';
    this.status = status;
    this.code = code;
  }
}

async function parseJsonResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new AuthRequestError(
      data.message || data.error || fallbackMessage,
      {
        status: response.status,
        code: data.code || 'AUTH_REQUEST_FAILED',
      }
    );
  }

  return data;
}

async function requestJson(
  path,
  {
    method = 'POST',
    token = '',
    body = undefined,
    keepalive = false,
    fallbackMessage = 'Request failed',
  } = {}
) {
  try {
    const response = await fetch(buildApiUrl(path), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      keepalive,
      cache: 'no-store',
    });

    return await parseJsonResponse(response, fallbackMessage);
  } catch (error) {
    if (error instanceof AuthRequestError) {
      throw error;
    }

    throw new AuthRequestError(
      'Unable to reach the server. Check your internet connection.',
      {
        status: 0,
        code: 'NETWORK_ERROR',
      }
    );
  }
}

let logoutInProgress = false;
let lifecycleInstalled = false;

export const authService = {
  login: async ({ email, password, stayLoggedIn = false }) => {
    return requestJson('/api/auth/login', {
      body: {
        email: String(email || '').trim().toLowerCase(),
        password,
        stayLoggedIn: Boolean(stayLoggedIn),
        deviceId: getAdminDeviceId(),
        pageId: PAGE_INSTANCE_ID,
      },
      fallbackMessage: 'Invalid credentials',
    });
  },

  resumeAdminSession: async (token) => {
    return requestJson('/api/auth/session/resume', {
      token,
      body: {
        deviceId: getAdminDeviceId(),
        pageId: PAGE_INSTANCE_ID,
      },
      fallbackMessage: 'Unable to resume the Admin session',
    });
  },

  heartbeatAdminSession: async (token) => {
    return requestJson('/api/auth/session/heartbeat', {
      token,
      body: { pageId: PAGE_INSTANCE_ID },
      fallbackMessage: 'Unable to refresh the Admin session',
    });
  },

  releaseAdminSessionPage: async (token, { keepalive = false } = {}) => {
    return requestJson('/api/auth/session/release', {
      token,
      body: { pageId: PAGE_INSTANCE_ID },
      keepalive,
      fallbackMessage: 'Unable to release the Admin session',
    });
  },

  releaseAdminSessionBeacon: (token) => {
    if (!navigator.sendBeacon) return false;

    const body = new URLSearchParams({
      token,
      pageId: PAGE_INSTANCE_ID,
    });

    return navigator.sendBeacon(
      buildApiUrl('/api/auth/session/release-beacon'),
      body
    );
  },

  getRecentAdminSessions: async (limit = 8) => {
    const active = getStoredPortalSession('admin');
    const token = active?.token || sessionStorage.getItem('adminToken') || '';

    return requestJson(`/api/auth/session/recent?limit=${limit}`, {
      method: 'GET',
      token,
      fallbackMessage: 'Unable to load recent sessions',
    });
  },

  getMyRecentActivity: async (limit = 8) => {
    const active = getStoredPortalSession('admin');
    const token = active?.token || sessionStorage.getItem('adminToken') || '';

    return requestJson(`/api/audit-logs/recent-activity?limit=${limit}`, {
      method: 'GET',
      token,
      fallbackMessage: 'Unable to load recent activity',
    });
  },

  startAdminPasswordReset: async (email = OFFICIAL_ADMIN_EMAIL) => {
    return requestJson('/api/auth/admin/forgot-password/start', {
      body: { email },
      fallbackMessage: 'Unable to send recovery code',
    });
  },

  verifyAdminPasswordResetOtp: async (
    otp,
    email = OFFICIAL_ADMIN_EMAIL
  ) => {
    return requestJson('/api/auth/admin/forgot-password/verify', {
      body: { email, otp },
      fallbackMessage: 'Invalid or expired recovery code',
    });
  },

  resetAdminPassword: async (
    resetToken,
    newPassword,
    email = OFFICIAL_ADMIN_EMAIL
  ) => {
    return requestJson('/api/auth/admin/forgot-password/reset', {
      body: { email, resetToken, newPassword },
      fallbackMessage: 'Unable to reset password',
    });
  },

  clearAuthStorage,

  logout: async () => {
    logoutInProgress = true;
    const active = getStoredPortalSession();

    try {
      if (active?.portalName === 'admin' && active.token) {
        await requestJson('/api/auth/session/logout', {
          token: active.token,
          body: {},
          keepalive: true,
          fallbackMessage: 'Unable to log out',
        });
      }
    } catch {
      // Local logout still proceeds even if the network request fails.
    } finally {
      clearAuthStorage();
      window.location.href = active?.loginPath || '/admin/login';
    }
  },
};

export function installAdminSessionLifecycle() {
  if (lifecycleInstalled || typeof window === 'undefined') {
    return;
  }

  lifecycleInstalled = true;

  const heartbeat = async () => {
    const active = getStoredPortalSession('admin');

    if (
      logoutInProgress ||
      !active?.token ||
      !navigator.onLine ||
      document.hidden
    ) {
      return;
    }

    try {
      await authService.heartbeatAdminSession(active.token);
    } catch (error) {
      if (
        error instanceof AuthRequestError &&
        error.code !== 'NETWORK_ERROR' &&
        [401, 409].includes(error.status)
      ) {
        clearAuthStorage();

        if (!window.location.pathname.startsWith('/admin/login')) {
          window.location.replace('/admin/login');
        }
      }
    }
  };

  const resumeWhenVisible = async () => {
    const active = getStoredPortalSession('admin');

    if (
      logoutInProgress ||
      !active?.token ||
      !navigator.onLine ||
      document.hidden
    ) {
      return;
    }

    try {
      await authService.resumeAdminSession(active.token);
    } catch (error) {
      if (
        error instanceof AuthRequestError &&
        error.code !== 'NETWORK_ERROR' &&
        [401, 409].includes(error.status)
      ) {
        clearAuthStorage();
        window.location.replace('/admin/login');
      }
    }
  };

  window.addEventListener('online', resumeWhenVisible);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      resumeWhenVisible();
    }
  });

  window.setInterval(heartbeat, 5 * 60_000);
}
