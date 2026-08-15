const DEVICE_ID_KEY = 'smartpdmAdminDeviceId';
const SESSION_FEEDBACK_KEY = 'smartpdmPortalSessionFeedback';
const SESSION_FEEDBACK_MAX_AGE_MS = 10 * 60_000;
const ACTIVE_PORTAL_HINT_KEY = 'smartpdmActivePortal';
const PORTAL_SESSION_CHANNEL = 'smartpdm-portal-session-sync-v1';
const PORTAL_SESSION_REQUEST_TIMEOUT_MS = 160;

export const PORTAL_CONFIG = {
    admin: {
        tokenKey: 'adminToken',
        profileKey: 'adminProfile',
        redirectPath: '/admin/dashboard',
        loginPath: '/admin/login',
    },
    pd: {
        tokenKey: 'pdToken',
        profileKey: 'pdProfile',
        redirectPath: '/pd/dashboard',
        loginPath: '/pd/login',
    },
    guidance: {
        tokenKey: 'guidanceToken',
        profileKey: 'guidanceProfile',
        redirectPath: '/guidance/dashboard',
        loginPath: '/guidance/login',
    },
    sdo: {
        tokenKey: 'sdoToken',
        profileKey: 'sdoProfile',
        redirectPath: '/sdo/dashboard',
        loginPath: '/sdo/login',
    },
    ro_coordinator: {
        tokenKey: 'roCoordinatorToken',
        profileKey: 'roCoordinatorProfile',
        redirectPath: '/ro-coordinator/dashboard',
        loginPath: '/ro-coordinator/login',
    },
};

const AUTH_STORAGE_KEYS = Object.values(PORTAL_CONFIG).flatMap((portal) => [
    portal.tokenKey,
    portal.profileKey,
]);

function isKnownPortalName(portalName) {
    return Boolean(portalName && PORTAL_CONFIG[portalName]);
}

function setActivePortalHint(portalName) {
    if (!isKnownPortalName(portalName)) return;
    localStorage.setItem(ACTIVE_PORTAL_HINT_KEY, portalName);
}

function clearActivePortalHint(portalName = null) {
    if (!portalName || localStorage.getItem(ACTIVE_PORTAL_HINT_KEY) === portalName) {
        localStorage.removeItem(ACTIVE_PORTAL_HINT_KEY);
    }
}

function clearTabAuthStorage() {
    AUTH_STORAGE_KEYS.forEach((key) => sessionStorage.removeItem(key));
}

function writePortalSessionToTab({ portalName, token, profile }) {
    const portal = PORTAL_CONFIG[portalName];
    if (!portal || !token) return null;

    clearTabAuthStorage();
    sessionStorage.setItem(portal.tokenKey, token);
    sessionStorage.setItem(portal.profileKey, JSON.stringify(profile || {}));
    setActivePortalHint(portalName);

    return {
        portalName,
        ...portal,
        token,
        profile: profile || null,
        remembered: Boolean(localStorage.getItem(portal.tokenKey)),
    };
}

export function getPortalNameFromPath(pathname = '') {
    const normalized = String(pathname || '').trim().toLowerCase();

    return (
        Object.entries(PORTAL_CONFIG).find(([, portal]) => {
            const portalRoot = portal.loginPath.replace(/\/login$/, '');
            return normalized === portalRoot || normalized.startsWith(`${portalRoot}/`);
        })?.[0] || null
    );
}

const SESSION_INVALIDATION_CODES = new Set([
    'ACCOUNT_DEACTIVATED',
    'SESSION_REVOKED',
    'SESSION_ROLE_CHANGED',
    'STAFF_ACCOUNT_NOT_FOUND',
    'STAFF_SESSION_INVALID',
    'TOKEN_EXPIRED',
    'TOKEN_INVALID',
    'SOCKET_AUTH_INVALID',
    'SOCKET_AUTH_REQUIRED',
    'ADMIN_SESSION_MIGRATION_REQUIRED',
    'ADMIN_SESSION_INVALID',
    'ADMIN_SESSION_TOKEN_MISSING',
    'ADMIN_SESSION_USER_MISSING',
    'ADMIN_SESSION_DEVICE_MISMATCH',
    'ADMIN_SESSION_INACTIVE',
    'ADMIN_SESSION_EXPIRED',
    'ADMIN_SESSION_LOGGED_OUT',
    'ADMIN_SESSION_NOT_FOUND',
    'ADMIN_SESSION_TOKEN_MISMATCH',
    'ADMIN_SESSION_SCOPE_MISMATCH',
    'NOT_ADMIN_ACCOUNT',
]);

function makeRandomId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
        .toString(36)
        .slice(2)}`;
}

export const PAGE_INSTANCE_ID = makeRandomId();

export function getAdminDeviceId() {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
        deviceId = makeRandomId();
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
}

export function getStoredItem(key) {
    return sessionStorage.getItem(key) || localStorage.getItem(key);
}

export function hydrateRememberedSessions() {
    AUTH_STORAGE_KEYS.forEach((key) => {
        const rememberedValue = localStorage.getItem(key);

        if (rememberedValue && !sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, rememberedValue);
        }
    });
}

export function clearAuthStorage() {
    AUTH_STORAGE_KEYS.forEach((key) => {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
    });
    clearActivePortalHint();
}

export function clearPortalSession(portalName) {
    const portal = PORTAL_CONFIG[portalName];
    if (!portal) return;

    [portal.tokenKey, portal.profileKey].forEach((key) => {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
    });
    clearActivePortalHint(portalName);
}

export function redirectPortalToLogin(portalName) {
    if (typeof window === 'undefined') return;

    const portal = PORTAL_CONFIG[portalName];
    if (!portal?.loginPath) return;

    const currentPath = window.location.pathname || '';
    if (currentPath === portal.loginPath || currentPath.startsWith(`${portal.loginPath}/`)) {
        return;
    }

    window.location.replace(portal.loginPath);
}

function buildSessionFeedback(code, message = '') {
    const normalizedCode = String(code || '').trim().toUpperCase();
    const normalizedMessage = String(message || '').trim().toLowerCase();

    if (
        normalizedCode === 'ACCOUNT_DEACTIVATED' ||
        normalizedMessage.includes('deactivated') ||
        normalizedMessage.includes('disabled')
    ) {
        return {
            title: 'Account Disabled',
            message:
                'Your account has been disabled by an administrator. Please contact the administrator for assistance.',
            tone: 'danger',
        };
    }

    if (
        normalizedCode === 'SESSION_ROLE_CHANGED' ||
        normalizedMessage.includes('access has changed') ||
        normalizedMessage.includes('role has changed')
    ) {
        return {
            title: 'Access Updated',
            message: 'Your account access has changed. Please sign in again.',
            tone: 'warning',
        };
    }

    if (
        normalizedCode === 'TOKEN_EXPIRED' ||
        normalizedCode === 'TOKEN_INVALID' ||
        normalizedCode === 'SOCKET_AUTH_INVALID' ||
        normalizedCode === 'ADMIN_SESSION_EXPIRED'
    ) {
        return {
            title: 'Session Expired',
            message: 'Your session has expired. Please sign in again.',
            tone: 'info',
        };
    }

    return {
        title: 'Session Ended',
        message: 'Your previous session is no longer active. Please sign in again.',
        tone: 'info',
    };
}

export function savePortalSessionFeedback({ portalName, code, message }) {
    if (!PORTAL_CONFIG[portalName]) return null;

    const feedback = {
        portalName,
        code: String(code || 'SESSION_REVOKED'),
        ...buildSessionFeedback(code, message),
        createdAt: Date.now(),
    };

    sessionStorage.setItem(SESSION_FEEDBACK_KEY, JSON.stringify(feedback));
    return feedback;
}

export function consumePortalSessionFeedback(portalName) {
    const raw = sessionStorage.getItem(SESSION_FEEDBACK_KEY);
    if (!raw) return null;

    let feedback;

    try {
        feedback = JSON.parse(raw);
    } catch {
        sessionStorage.removeItem(SESSION_FEEDBACK_KEY);
        return null;
    }

    const createdAt = Number(feedback?.createdAt || 0);
    const isExpired = !createdAt || Date.now() - createdAt > SESSION_FEEDBACK_MAX_AGE_MS;

    if (isExpired) {
        sessionStorage.removeItem(SESSION_FEEDBACK_KEY);
        return null;
    }

    if (feedback?.portalName !== portalName) {
        return null;
    }

    sessionStorage.removeItem(SESSION_FEEDBACK_KEY);
    return feedback;
}

export function clearPortalSessionFeedback(portalName = null) {
    if (!portalName) {
        sessionStorage.removeItem(SESSION_FEEDBACK_KEY);
        return;
    }

    const raw = sessionStorage.getItem(SESSION_FEEDBACK_KEY);
    if (!raw) return;

    try {
        const feedback = JSON.parse(raw);
        if (feedback?.portalName === portalName) {
            sessionStorage.removeItem(SESSION_FEEDBACK_KEY);
        }
    } catch {
        sessionStorage.removeItem(SESSION_FEEDBACK_KEY);
    }
}

export function invalidateStoredPortalSession({ portalName, code, message }) {
    const resolvedPortalName = PORTAL_CONFIG[portalName]
        ? portalName
        : getStoredPortalSession()?.portalName || null;

    if (!resolvedPortalName || !PORTAL_CONFIG[resolvedPortalName]) {
        return null;
    }

    const feedback = savePortalSessionFeedback({
        portalName: resolvedPortalName,
        code,
        message,
    });

    clearPortalSession(resolvedPortalName);

    if (typeof window !== 'undefined') {
        window.dispatchEvent(
            new CustomEvent('portal-session:invalidated', {
                detail: {
                    portalName: resolvedPortalName,
                    code: String(code || 'SESSION_REVOKED'),
                    message: String(message || ''),
                    feedback,
                },
            })
        );

        // Do not depend on a particular layout component being mounted to
        // perform the forced logout. This also covers idle dashboards and
        // invalidations raised by the global HTTP guard.
        redirectPortalToLogin(resolvedPortalName);
    }

    return {
        portalName: resolvedPortalName,
        feedback,
    };
}

let fetchSessionGuardInstalled = false;

export function installSessionInvalidationFetchGuard() {
    if (
        fetchSessionGuardInstalled ||
        typeof window === 'undefined' ||
        typeof window.fetch !== 'function'
    ) {
        return;
    }

    fetchSessionGuardInstalled = true;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
        const response = await originalFetch(...args);

        if (response.status !== 401) {
            return response;
        }

        // Only authenticated portal sessions are eligible for forced logout.
        // A failed login request must keep its normal login error behavior.
        const activeSession = getStoredPortalSession();
        if (!activeSession?.token) {
            return response;
        }

        try {
            const payload = await response.clone().json();
            const code = String(payload?.code || '').trim().toUpperCase();

            if (SESSION_INVALIDATION_CODES.has(code)) {
                invalidateStoredPortalSession({
                    portalName: activeSession.portalName,
                    code,
                    message: payload?.message || payload?.error || '',
                });
            }
        } catch {
            // Non-JSON 401 responses keep their existing caller-side handling.
        }

        return response;
    };
}

export function savePortalSession({ portalName, token, user, stayLoggedIn }) {
    const portal = PORTAL_CONFIG[portalName];

    if (!portal) {
        throw new Error(`Unknown portal: ${portalName}`);
    }

    clearAuthStorage();
    clearPortalSessionFeedback(portalName);

    const profileJson = JSON.stringify(user || {});

    writePortalSessionToTab({
        portalName,
        token,
        profile: user || {},
    });

    if (stayLoggedIn) {
        localStorage.setItem(portal.tokenKey, token);
        localStorage.setItem(portal.profileKey, profileJson);
    }

    setActivePortalHint(portalName);
}

export function getPortalNameFromRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    return PORTAL_CONFIG[normalized] ? normalized : 'admin';
}

export function getPortalNameFromTokenKey(tokenKey) {
    return (
        Object.entries(PORTAL_CONFIG).find(
            ([, portal]) => portal.tokenKey === tokenKey
        )?.[0] || null
    );
}

export function getStoredPortalSession(portalName = null) {
    const entries = portalName
        ? [[portalName, PORTAL_CONFIG[portalName]]]
        : Object.entries(PORTAL_CONFIG);

    for (const [name, portal] of entries) {
        if (!portal) continue;

        const token = getStoredItem(portal.tokenKey);
        if (!token) continue;

        const rawProfile = getStoredItem(portal.profileKey);
        let profile = null;

        try {
            profile = rawProfile ? JSON.parse(rawProfile) : null;
        } catch {
            profile = null;
        }

        return {
            portalName: name,
            ...portal,
            token,
            profile,
            remembered: Boolean(localStorage.getItem(portal.tokenKey)),
        };
    }

    return null;
}

let portalSessionSyncChannel = null;

function createPortalSessionChannel() {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
        return null;
    }

    try {
        return new BroadcastChannel(PORTAL_SESSION_CHANNEL);
    } catch {
        return null;
    }
}

export async function hydratePortalSessionFromPeerTabs({
    portalName = null,
    timeoutMs = PORTAL_SESSION_REQUEST_TIMEOUT_MS,
} = {}) {
    if (typeof window === 'undefined') return null;

    const requestedPortal = isKnownPortalName(portalName)
        ? portalName
        : isKnownPortalName(localStorage.getItem(ACTIVE_PORTAL_HINT_KEY))
          ? localStorage.getItem(ACTIVE_PORTAL_HINT_KEY)
          : null;

    const existing = requestedPortal
        ? getStoredPortalSession(requestedPortal)
        : getStoredPortalSession();

    if (existing?.token) {
        setActivePortalHint(existing.portalName);
        return existing;
    }

    const channel = createPortalSessionChannel();
    if (!channel) return null;

    const requestId = makeRandomId();

    return new Promise((resolve) => {
        let settled = false;
        const finish = (session = null) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            channel.close();
            resolve(session);
        };

        const timer = window.setTimeout(() => finish(null), Math.max(40, Number(timeoutMs) || 0));

        channel.onmessage = (event) => {
            const payload = event?.data || {};
            if (payload.type !== 'SESSION_RESPONSE' || payload.requestId !== requestId) return;
            if (!isKnownPortalName(payload.portalName) || !payload.token) return;
            if (requestedPortal && payload.portalName !== requestedPortal) return;

            const session = writePortalSessionToTab({
                portalName: payload.portalName,
                token: payload.token,
                profile: payload.profile || {},
            });

            finish(session);
        };

        channel.postMessage({
            type: 'SESSION_REQUEST',
            requestId,
            portalName: requestedPortal,
        });
    });
}

export function installPortalSessionSync() {
    if (portalSessionSyncChannel || typeof window === 'undefined') return;

    portalSessionSyncChannel = createPortalSessionChannel();
    if (!portalSessionSyncChannel) return;

    const current = getStoredPortalSession();
    if (current?.portalName) {
        setActivePortalHint(current.portalName);
    }

    portalSessionSyncChannel.onmessage = (event) => {
        const payload = event?.data || {};

        if (payload.type === 'SESSION_REQUEST') {
            const requestedPortal = isKnownPortalName(payload.portalName)
                ? payload.portalName
                : null;
            const active = requestedPortal
                ? getStoredPortalSession(requestedPortal)
                : getStoredPortalSession();

            if (!active?.token) return;

            portalSessionSyncChannel.postMessage({
                type: 'SESSION_RESPONSE',
                requestId: payload.requestId,
                portalName: active.portalName,
                token: active.token,
                profile: active.profile || {},
            });
            return;
        }

        if (payload.type === 'SESSION_CLEARED' && isKnownPortalName(payload.portalName)) {
            const active = getStoredPortalSession(payload.portalName);
            if (!active?.token) return;

            clearPortalSession(payload.portalName);
            redirectPortalToLogin(payload.portalName);
        }
    };
}

export function broadcastPortalSessionCleared(portalName) {
    if (!isKnownPortalName(portalName)) return;

    const channel = portalSessionSyncChannel || createPortalSessionChannel();
    if (!channel) return;

    channel.postMessage({
        type: 'SESSION_CLEARED',
        portalName,
    });

    if (channel !== portalSessionSyncChannel) {
        channel.close();
    }
}

