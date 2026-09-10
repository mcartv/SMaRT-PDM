import { buildApiUrl } from '@/api';
import {
  PAGE_INSTANCE_ID,
  broadcastPortalSessionCleared,
  clearAuthStorage,
  clearPortalSession,
  clearPortalSessionFeedback,
  getAdminDeviceId,
  getStoredPortalSession,
  invalidateStoredPortalSession,
  isSessionInvalidationError,
} from '@/utils/authStorage';

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
let validationInFlight = false;

function invalidateIfStillCurrent(active, error) {
  if (
    !active?.portalName ||
    !active?.token ||
    !(error instanceof AuthRequestError) ||
    !isSessionInvalidationError(error)
  ) {
    return null;
  }

  return invalidateStoredPortalSession({
    portalName: active.portalName,
    expectedToken: active.token,
    expectedBrowserSessionId: active.browserSessionId || '',
    code: error.code,
    message: error.message,
  });
}

export const authService = {
  login: async ({ email, password, stayLoggedIn = false, turnstileToken = '' }) => {
    return requestJson('/api/auth/login', {
      body: {
        email: String(email || '').trim().toLowerCase(),
        password,
        stayLoggedIn: Boolean(stayLoggedIn),
        deviceId: getAdminDeviceId(),
        pageId: PAGE_INSTANCE_ID,
        turnstileToken: String(turnstileToken || ''),
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

  validateStaffSession: async (token) => {
    try {
      return await requestJson('/api/auth/session/check', {
        method: 'GET',
        token,
        fallbackMessage: 'Unable to validate the account session',
      });
    } catch (error) {
      // Compatibility fallback for a backend that has not yet exposed the
      // dedicated lightweight session-check route. This endpoint is already
      // protected for every staff role, so backend authorization still decides
      // whether the candidate token is allowed.
      if (error instanceof AuthRequestError && error.status === 404) {
        return requestJson('/api/theme-settings', {
          method: 'GET',
          token,
          fallbackMessage: 'Unable to validate the account session',
        });
      }

      throw error;
    }
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

  logoutAdminSessionBeacon: (token) => {
    if (!token || !navigator.sendBeacon) return false;

    const body = new URLSearchParams({ token });

    return navigator.sendBeacon(
      buildApiUrl('/api/auth/session/logout-beacon'),
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

  startAdminPasswordReset: async (email) => {
    return requestJson('/api/auth/admin/forgot-password/start', {
      body: { email: String(email || '').trim().toLowerCase() },
      fallbackMessage: 'Unable to send recovery code',
    });
  },

  verifyAdminPasswordResetOtp: async (
    otp,
    email
  ) => {
    return requestJson('/api/auth/admin/forgot-password/verify', {
      body: { email: String(email || '').trim().toLowerCase(), otp },
      fallbackMessage: 'Invalid or expired recovery code',
    });
  },

  resetAdminPassword: async (
    resetToken,
    newPassword,
    email
  ) => {
    return requestJson('/api/auth/admin/forgot-password/reset', {
      body: { email: String(email || '').trim().toLowerCase(), resetToken, newPassword },
      fallbackMessage: 'Unable to reset password',
    });
  },

  clearAuthStorage,

  logout: async () => {
    logoutInProgress = true;
    const active = getStoredPortalSession();

    // Server-side Admin logout targets the exact session captured when the user
    // clicked Logout. A later replacement login must not be erased by this
    // request completing after the newer session has become current.
    let beaconQueued = false;
    if (active?.portalName === 'admin' && active.token) {
      beaconQueued = authService.logoutAdminSessionBeacon(active.token);
    }

    try {
      if (active?.portalName === 'admin' && active.token && !beaconQueued) {
        await requestJson('/api/auth/session/logout', {
          token: active.token,
          body: {},
          keepalive: true,
          fallbackMessage: 'Unable to log out',
        });
      }
    } catch {
      // Local/cross-tab logout still proceeds for the captured session. A
      // same-device Admin login can replace stale backend state if necessary.
    } finally {
      clearPortalSessionFeedback(active?.portalName || null);

      if (active?.portalName && active?.token) {
        broadcastPortalSessionCleared(active.portalName, active);

        const cleared = clearPortalSession(active.portalName, {
          expectedToken: active.token,
          expectedBrowserSessionId: active.browserSessionId || '',
        });
        const replacement = getStoredPortalSession(active.portalName);

        if (cleared && !replacement?.token) {
          window.location.href = '/login';
          return;
        }

        // Another tab established a newer session while this logout request was
        // in flight. The logout belongs only to the captured old session, so
        // the replacement remains active and this tab must not force /login.
        logoutInProgress = false;
        return;
      }

      clearAuthStorage();
      window.location.href = '/login';
    }
  },
};

export function installAdminSessionLifecycle() {
  if (lifecycleInstalled || typeof window === 'undefined') {
    return;
  }

  lifecycleInstalled = true;

  const validateCurrentPortal = async () => {
    const active = getStoredPortalSession();

    if (
      logoutInProgress ||
      validationInFlight ||
      !active?.token ||
      !navigator.onLine
    ) {
      return;
    }

    validationInFlight = true;

    try {
      await authService.validateStaffSession(active.token);
    } catch (error) {
      invalidateIfStillCurrent(active, error);
    } finally {
      validationInFlight = false;
    }
  };

  const heartbeat = async () => {
    const active = getStoredPortalSession('admin');

    if (
      logoutInProgress ||
      !active?.token ||
      !navigator.onLine
    ) {
      return;
    }

    try {
      await authService.heartbeatAdminSession(active.token);
    } catch (error) {
      invalidateIfStillCurrent(active, error);
    }
  };

  const resumeWhenVisible = async () => {
    const active = getStoredPortalSession('admin');

    if (
      logoutInProgress ||
      !active?.token ||
      !navigator.onLine
    ) {
      return;
    }

    try {
      await authService.resumeAdminSession(active.token);
    } catch (error) {
      invalidateIfStillCurrent(active, error);
    }
  };

  const validateWhenVisible = () => {
    if (document.hidden) return;
    validateCurrentPortal();

    const active = getStoredPortalSession();
    if (active?.portalName === 'admin') {
      resumeWhenVisible();
    }
  };

  window.addEventListener('online', validateWhenVisible);
  window.addEventListener('focus', validateWhenVisible);
  document.addEventListener('visibilitychange', validateWhenVisible);

  // Account access is validated independently of Socket.IO. The backend is the
  // source of truth; captured session identity prevents stale async failures
  // from invalidating a newer cross-tab login.
  validateCurrentPortal();
  window.setInterval(validateCurrentPortal, 60_000);
  window.setInterval(heartbeat, 5 * 60_000);
}
