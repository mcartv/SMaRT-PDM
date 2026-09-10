const DEVICE_ID_KEY = 'smartpdmAdminDeviceId';
const SESSION_FEEDBACK_KEY = 'smartpdmPortalSessionFeedback';
const SESSION_FEEDBACK_MAX_AGE_MS = 10 * 60_000;
const ACTIVE_PORTAL_HINT_KEY = 'smartpdmActivePortal';
const PORTAL_SESSION_CHANNEL = 'smartpdm-portal-session-sync-v2';
const PORTAL_SESSION_STORAGE_EVENT_KEY = 'smartpdmPortalSessionSyncEventV2';
const PORTAL_SESSION_REQUEST_TIMEOUT_MS = 1_800;
const PORTAL_SESSION_META_PREFIX = 'smartpdmPortalSessionMetaV2';
const PROCESSED_SYNC_EVENT_LIMIT = 128;

export const PORTAL_CONFIG = {
    admin: {
        tokenKey: 'adminToken',
        profileKey: 'adminProfile',
        rootPath: '/admin',
        redirectPath: '/admin/dashboard',
        loginPath: '/login',
    },
    pd: {
        tokenKey: 'pdToken',
        profileKey: 'pdProfile',
        rootPath: '/pd',
        redirectPath: '/pd/dashboard',
        loginPath: '/login',
    },
    guidance: {
        tokenKey: 'guidanceToken',
        profileKey: 'guidanceProfile',
        rootPath: '/guidance',
        redirectPath: '/guidance/dashboard',
        loginPath: '/login',
    },
    sdo: {
        tokenKey: 'sdoToken',
        profileKey: 'sdoProfile',
        rootPath: '/sdo',
        redirectPath: '/sdo/dashboard',
        loginPath: '/login',
    },
    ro_coordinator: {
        tokenKey: 'roCoordinatorToken',
        profileKey: 'roCoordinatorProfile',
        rootPath: '/ro-coordinator',
        redirectPath: '/ro-coordinator/dashboard',
        loginPath: '/login',
    },
};

const AUTH_STORAGE_KEYS = Object.values(PORTAL_CONFIG).flatMap((portal) => [
    portal.tokenKey,
    portal.profileKey,
]);

function isKnownPortalName(portalName) {
    return Boolean(portalName && PORTAL_CONFIG[portalName]);
}

function getPortalSessionMetaKey(portalName) {
    return `${PORTAL_SESSION_META_PREFIX}:${portalName}`;
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

function makeRandomId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
        .toString(36)
        .slice(2)}`;
}

function tokenMarker(token) {
    const value = String(token || '').trim();
    if (!value) return '';
    return value.slice(-32);
}

function decodeJwtPayload(token) {
    try {
        const value = String(token || '').trim();
        const parts = value.split('.');
        if (parts.length < 2) return {};

        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';

        return JSON.parse(globalThis.atob(base64)) || {};
    } catch {
        return {};
    }
}

function deriveServerSessionId(token) {
    const payload = decodeJwtPayload(token);
    const value = payload?.sid || payload?.session_id || null;
    return value ? String(value) : null;
}

function readPortalSessionMeta(storage, portalName, token) {
    if (!storage || !isKnownPortalName(portalName) || !token) return null;

    const raw = storage.getItem(getPortalSessionMetaKey(portalName));
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        if (!parsed?.browserSessionId) return null;
        if (parsed.tokenMarker && parsed.tokenMarker !== tokenMarker(token)) return null;

        return {
            browserSessionId: String(parsed.browserSessionId),
            serverSessionId: parsed.serverSessionId ? String(parsed.serverSessionId) : null,
            tokenMarker: tokenMarker(token),
            createdAt: Number(parsed.createdAt || Date.now()),
        };
    } catch {
        return null;
    }
}

function createPortalSessionMeta(token, {
    browserSessionId = '',
    serverSessionId = null,
    createdAt = Date.now(),
} = {}) {
    return {
        browserSessionId: String(browserSessionId || '').trim() || makeRandomId(),
        serverSessionId:
            String(serverSessionId || '').trim() ||
            deriveServerSessionId(token) ||
            null,
        tokenMarker: tokenMarker(token),
        createdAt: Number(createdAt || Date.now()),
    };
}

function writePortalSessionMeta(storage, portalName, meta) {
    if (!storage || !isKnownPortalName(portalName) || !meta?.browserSessionId) return;
    storage.setItem(getPortalSessionMetaKey(portalName), JSON.stringify(meta));
}

function getOrCreatePortalSessionMeta(portalName, token) {
    if (!isKnownPortalName(portalName) || !token) return null;

    const fromTab = readPortalSessionMeta(sessionStorage, portalName, token);
    if (fromTab) return fromTab;

    const portal = PORTAL_CONFIG[portalName];
    const rememberedToken = localStorage.getItem(portal.tokenKey);
    const fromRemembered =
        rememberedToken === token
            ? readPortalSessionMeta(localStorage, portalName, token)
            : null;

    if (fromRemembered) {
        writePortalSessionMeta(sessionStorage, portalName, fromRemembered);
        return fromRemembered;
    }

    const meta = createPortalSessionMeta(token);
    writePortalSessionMeta(sessionStorage, portalName, meta);

    if (rememberedToken === token) {
        writePortalSessionMeta(localStorage, portalName, meta);
    }

    return meta;
}

function clearTabAuthStorage() {
    AUTH_STORAGE_KEYS.forEach((key) => sessionStorage.removeItem(key));
    Object.keys(PORTAL_CONFIG).forEach((portalName) => {
        sessionStorage.removeItem(getPortalSessionMetaKey(portalName));
    });
}

function writePortalSessionToTab({
    portalName,
    token,
    profile,
    browserSessionId = '',
    serverSessionId = null,
    createdAt = Date.now(),
}) {
    const portal = PORTAL_CONFIG[portalName];
    if (!portal || !token) return null;

    const existing =
        getStoredPortalSession(portalName)?.token === token
            ? getOrCreatePortalSessionMeta(portalName, token)
            : null;
    const meta =
        existing ||
        createPortalSessionMeta(token, {
            browserSessionId,
            serverSessionId,
            createdAt,
        });

    clearTabAuthStorage();
    sessionStorage.setItem(portal.tokenKey, token);
    sessionStorage.setItem(portal.profileKey, JSON.stringify(profile || {}));
    writePortalSessionMeta(sessionStorage, portalName, meta);
    setActivePortalHint(portalName);

    return {
        portalName,
        ...portal,
        token,
        profile: profile || null,
        remembered: Boolean(localStorage.getItem(portal.tokenKey)),
        browserSessionId: meta.browserSessionId,
        serverSessionId: meta.serverSessionId,
        sessionCreatedAt: meta.createdAt,
    };
}

export function getPortalNameFromPath(pathname = '') {
    const normalized = String(pathname || '').trim().toLowerCase();

    return (
        Object.entries(PORTAL_CONFIG).find(([, portal]) => {
            const portalRoot = portal.rootPath;
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

export function isSessionInvalidationError(error = {}) {
    const code = String(error?.code || '').trim().toUpperCase();
    return SESSION_INVALIDATION_CODES.has(code);
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

    Object.entries(PORTAL_CONFIG).forEach(([portalName, portal]) => {
        const token = sessionStorage.getItem(portal.tokenKey);
        if (!token) return;

        const rememberedToken = localStorage.getItem(portal.tokenKey);
        const rememberedMeta =
            rememberedToken === token
                ? readPortalSessionMeta(localStorage, portalName, token)
                : null;
        const tabMeta = readPortalSessionMeta(sessionStorage, portalName, token);

        if (rememberedMeta && !tabMeta) {
            writePortalSessionMeta(sessionStorage, portalName, rememberedMeta);
            return;
        }

        if (!tabMeta) {
            const meta = createPortalSessionMeta(token);
            writePortalSessionMeta(sessionStorage, portalName, meta);
            if (rememberedToken === token) {
                writePortalSessionMeta(localStorage, portalName, meta);
            }
        }
    });
}

export function clearAuthStorage() {
    AUTH_STORAGE_KEYS.forEach((key) => {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
    });

    Object.keys(PORTAL_CONFIG).forEach((portalName) => {
        const metaKey = getPortalSessionMetaKey(portalName);
        sessionStorage.removeItem(metaKey);
        localStorage.removeItem(metaKey);
    });

    clearActivePortalHint();
}

export function clearPortalSession(
    portalName,
    { expectedToken = '', expectedBrowserSessionId = '' } = {}
) {
    const portal = PORTAL_CONFIG[portalName];
    if (!portal) return false;

    const normalizedExpectedToken = String(expectedToken || '').trim();
    const normalizedExpectedBrowserSessionId = String(expectedBrowserSessionId || '').trim();
    const metaKey = getPortalSessionMetaKey(portalName);

    const clearMatchingStorage = (storage) => {
        const storedToken = storage.getItem(portal.tokenKey);
        const storedProfile = storage.getItem(portal.profileKey);
        const storedMeta = storedToken
            ? readPortalSessionMeta(storage, portalName, storedToken)
            : null;

        if (normalizedExpectedToken && storedToken !== normalizedExpectedToken) {
            return false;
        }

        if (
            !normalizedExpectedToken &&
            normalizedExpectedBrowserSessionId &&
            storedMeta?.browserSessionId !== normalizedExpectedBrowserSessionId
        ) {
            return false;
        }

        if (
            !storedToken &&
            storedProfile === null &&
            storage.getItem(metaKey) === null
        ) {
            return false;
        }

        storage.removeItem(portal.tokenKey);
        storage.removeItem(portal.profileKey);
        storage.removeItem(metaKey);
        return true;
    };

    // Clear each storage independently. A stale tab may still hold token A in
    // sessionStorage while another tab has already persisted newer token B in
    // localStorage; invalidating A must never delete B's remembered session.
    const clearedTab = clearMatchingStorage(sessionStorage);
    const clearedRemembered = clearMatchingStorage(localStorage);
    const cleared = clearedTab || clearedRemembered;

    if (
        !sessionStorage.getItem(portal.tokenKey) &&
        !localStorage.getItem(portal.tokenKey)
    ) {
        clearActivePortalHint(portalName);
    }

    return cleared;
}

export function redirectPortalToLogin(portalName) {
    if (typeof window === 'undefined') return;
    if (!PORTAL_CONFIG[portalName]) return;

    const currentPath = window.location.pathname || '';
    if (currentPath === '/login') return;

    window.location.replace('/login');
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

export function invalidateStoredPortalSession({
    portalName,
    code,
    message,
    expectedToken = '',
    expectedBrowserSessionId = '',
}) {
    const resolvedPortalName = PORTAL_CONFIG[portalName]
        ? portalName
        : getStoredPortalSession()?.portalName || null;

    if (!resolvedPortalName || !PORTAL_CONFIG[resolvedPortalName]) {
        return null;
    }

    const active = getStoredPortalSession(resolvedPortalName);
    if (!active?.token) {
        return null;
    }

    const normalizedExpectedToken = String(expectedToken || '').trim();
    const normalizedExpectedBrowserSessionId = String(expectedBrowserSessionId || '').trim();

    if (normalizedExpectedToken && active.token !== normalizedExpectedToken) {
        return {
            portalName: resolvedPortalName,
            ignored: true,
            reason: 'stale-token',
        };
    }

    if (
        !normalizedExpectedToken &&
        normalizedExpectedBrowserSessionId &&
        active.browserSessionId !== normalizedExpectedBrowserSessionId
    ) {
        return {
            portalName: resolvedPortalName,
            ignored: true,
            reason: 'stale-browser-session',
        };
    }

    const feedback = savePortalSessionFeedback({
        portalName: resolvedPortalName,
        code,
        message,
    });

    broadcastPortalSessionCleared(resolvedPortalName, active);

    const cleared = clearPortalSession(resolvedPortalName, {
        expectedToken: active.token,
        expectedBrowserSessionId: active.browserSessionId,
    });

    if (!cleared) {
        return {
            portalName: resolvedPortalName,
            ignored: true,
            reason: 'session-changed-before-clear',
        };
    }

    const replacementSession = getStoredPortalSession(resolvedPortalName);
    if (replacementSession?.token && replacementSession.token !== active.token) {
        clearPortalSessionFeedback(resolvedPortalName);
        return {
            portalName: resolvedPortalName,
            ignored: true,
            reason: 'replacement-session-present',
        };
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(
            new CustomEvent('portal-session:invalidated', {
                detail: {
                    portalName: resolvedPortalName,
                    browserSessionId: active.browserSessionId,
                    serverSessionId: active.serverSessionId,
                    code: String(code || 'SESSION_REVOKED'),
                    message: String(message || ''),
                    feedback,
                },
            })
        );

        // The backend remains the source of truth. This redirect only happens
        // after the exact currently stored session has been proven invalid.
        redirectPortalToLogin(resolvedPortalName);
    }

    return {
        portalName: resolvedPortalName,
        feedback,
        ignored: false,
    };
}

function readAuthorizationHeader(headers) {
    if (!headers) return '';

    try {
        if (typeof headers.get === 'function') {
            return String(headers.get('Authorization') || headers.get('authorization') || '');
        }

        if (Array.isArray(headers)) {
            const entry = headers.find(
                ([key]) => String(key || '').trim().toLowerCase() === 'authorization'
            );
            return String(entry?.[1] || '');
        }

        if (typeof headers === 'object') {
            const key = Object.keys(headers).find(
                (name) => String(name).trim().toLowerCase() === 'authorization'
            );
            return key ? String(headers[key] || '') : '';
        }
    } catch {
        return '';
    }

    return '';
}

function getFetchRequestToken(input, init = {}) {
    let authorization = readAuthorizationHeader(init?.headers);

    if (
        !authorization &&
        typeof Request !== 'undefined' &&
        input instanceof Request
    ) {
        authorization = readAuthorizationHeader(input.headers);
    }

    const match = authorization.trim().match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || '';
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
        // Capture the identity that actually sent the request. A delayed 401
        // from an older token must never invalidate a newer cross-tab session.
        const requestToken = getFetchRequestToken(args[0], args[1] || {});
        const requestSession =
            requestToken &&
            Object.keys(PORTAL_CONFIG)
                .map((portalName) => getStoredPortalSession(portalName))
                .find((session) => session?.token === requestToken);

        const response = await originalFetch(...args);

        if (response.status !== 401 || !requestToken) {
            return response;
        }

        const activeSession = getStoredPortalSession();
        if (!activeSession?.token || activeSession.token !== requestToken) {
            return response;
        }

        try {
            const payload = await response.clone().json();
            const code = String(payload?.code || '').trim().toUpperCase();

            if (SESSION_INVALIDATION_CODES.has(code)) {
                invalidateStoredPortalSession({
                    portalName: activeSession.portalName,
                    expectedToken: requestToken,
                    expectedBrowserSessionId: requestSession?.browserSessionId || '',
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
    const meta = createPortalSessionMeta(token);

    const session = writePortalSessionToTab({
        portalName,
        token,
        profile: user || {},
        browserSessionId: meta.browserSessionId,
        serverSessionId: meta.serverSessionId,
        createdAt: meta.createdAt,
    });

    if (stayLoggedIn) {
        localStorage.setItem(portal.tokenKey, token);
        localStorage.setItem(portal.profileKey, profileJson);
        writePortalSessionMeta(localStorage, portalName, meta);
    }

    setActivePortalHint(portalName);
    broadcastPortalSessionEstablished(session);
    return session;
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

        const tabToken = sessionStorage.getItem(portal.tokenKey);
        const rememberedToken = localStorage.getItem(portal.tokenKey);
        const token = tabToken || rememberedToken;
        if (!token) continue;

        const rawProfile =
            (tabToken ? sessionStorage.getItem(portal.profileKey) : null) ||
            localStorage.getItem(portal.profileKey);
        let profile = null;

        try {
            profile = rawProfile ? JSON.parse(rawProfile) : null;
        } catch {
            profile = null;
        }

        const meta = getOrCreatePortalSessionMeta(name, token);

        return {
            portalName: name,
            ...portal,
            token,
            profile,
            remembered: Boolean(rememberedToken),
            browserSessionId: meta?.browserSessionId || null,
            serverSessionId: meta?.serverSessionId || null,
            sessionCreatedAt: meta?.createdAt || null,
        };
    }

    return null;
}

function getTabPortalSession(portalName = null) {
    const entries = portalName
        ? [[portalName, PORTAL_CONFIG[portalName]]]
        : Object.entries(PORTAL_CONFIG);

    for (const [name, portal] of entries) {
        if (!portal) continue;

        const token = sessionStorage.getItem(portal.tokenKey);
        if (!token) continue;

        let profile = null;
        try {
            const rawProfile = sessionStorage.getItem(portal.profileKey);
            profile = rawProfile ? JSON.parse(rawProfile) : null;
        } catch {
            profile = null;
        }

        const meta = getOrCreatePortalSessionMeta(name, token);

        return {
            portalName: name,
            ...portal,
            token,
            profile,
            browserSessionId: meta?.browserSessionId || null,
            serverSessionId: meta?.serverSessionId || null,
            sessionCreatedAt: meta?.createdAt || null,
        };
    }

    return null;
}

let portalSessionSyncChannel = null;
let portalSessionSyncInstalled = false;
const processedSyncEventIds = new Set();

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

function normalizeSyncPayload(payload = {}) {
    return {
        ...payload,
        sourceId: String(payload.sourceId || PAGE_INSTANCE_ID),
        eventId: String(payload.eventId || makeRandomId()),
    };
}

function publishPortalSessionStorageEvent(payload) {
    if (typeof window === 'undefined') return false;

    try {
        localStorage.setItem(
            PORTAL_SESSION_STORAGE_EVENT_KEY,
            JSON.stringify(payload)
        );
        localStorage.removeItem(PORTAL_SESSION_STORAGE_EVENT_KEY);
        return true;
    } catch {
        return false;
    }
}

function publishPortalSessionMessage(payload, channel = portalSessionSyncChannel) {
    const normalized = normalizeSyncPayload(payload);
    let sentViaChannel = false;

    if (channel) {
        try {
            channel.postMessage(normalized);
            sentViaChannel = true;
        } catch {
            sentViaChannel = false;
        }
    }

    // Storage events are a fallback only. Sending through both transports
    // caused duplicate/out-of-order authentication events between tabs.
    if (!sentViaChannel) {
        publishPortalSessionStorageEvent(normalized);
    }

    return normalized;
}

function shouldHandleSyncPayload(payload = {}) {
    if (payload.sourceId && payload.sourceId === PAGE_INSTANCE_ID) {
        return false;
    }

    const eventId = String(payload.eventId || '').trim();
    if (!eventId) {
        // Legacy messages are accepted except for ambiguous clear events,
        // which are rejected separately because they cannot identify a session.
        return true;
    }

    if (processedSyncEventIds.has(eventId)) {
        return false;
    }

    processedSyncEventIds.add(eventId);
    if (processedSyncEventIds.size > PROCESSED_SYNC_EVENT_LIMIT) {
        const oldest = processedSyncEventIds.values().next().value;
        processedSyncEventIds.delete(oldest);
    }

    return true;
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

    if (!requestedPortal) return null;

    const channel = createPortalSessionChannel();
    const requestId = makeRandomId();

    return new Promise((resolve) => {
        let settled = false;

        const finish = (session = null) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            channel?.close();
            window.removeEventListener('storage', handleStorageResponse);
            resolve(session);
        };

        const handlePayload = (payload = {}) => {
            if (payload.type !== 'SESSION_RESPONSE' || payload.requestId !== requestId) return;
            if (!isKnownPortalName(payload.portalName) || !payload.token) return;
            if (requestedPortal && payload.portalName !== requestedPortal) return;

            const session = writePortalSessionToTab({
                portalName: payload.portalName,
                token: payload.token,
                profile: payload.profile || {},
                browserSessionId: payload.browserSessionId || '',
                serverSessionId: payload.serverSessionId || null,
                createdAt: payload.sessionCreatedAt || Date.now(),
            });

            finish(session);
        };

        const handleStorageResponse = (event) => {
            if (event.key !== PORTAL_SESSION_STORAGE_EVENT_KEY || !event.newValue) return;

            try {
                const payload = JSON.parse(event.newValue);
                if (!shouldHandleSyncPayload(payload)) return;
                handlePayload(payload);
            } catch {
                // Ignore malformed cross-tab events.
            }
        };

        const timer = window.setTimeout(
            () => finish(null),
            Math.max(40, Number(timeoutMs) || 0)
        );

        if (channel) {
            channel.onmessage = (event) => {
                const payload = event?.data || {};
                if (!shouldHandleSyncPayload(payload)) return;
                handlePayload(payload);
            };
        }

        window.addEventListener('storage', handleStorageResponse);

        publishPortalSessionMessage(
            {
                type: 'SESSION_REQUEST',
                requestId,
                portalName: requestedPortal,
            },
            channel
        );
    });
}

export function installPortalSessionSync() {
    if (portalSessionSyncInstalled || typeof window === 'undefined') return;

    portalSessionSyncInstalled = true;
    portalSessionSyncChannel = createPortalSessionChannel();

    const current = getStoredPortalSession();
    if (current?.portalName) {
        setActivePortalHint(current.portalName);
    }

    const handleSyncPayload = (payload = {}) => {
        if (!shouldHandleSyncPayload(payload)) return;

        if (payload.type === 'SESSION_REQUEST') {
            const requestedPortal = isKnownPortalName(payload.portalName)
                ? payload.portalName
                : null;
            const active = requestedPortal
                ? getStoredPortalSession(requestedPortal)
                : getStoredPortalSession();

            if (!active?.token) return;

            publishPortalSessionMessage({
                type: 'SESSION_RESPONSE',
                requestId: payload.requestId,
                portalName: active.portalName,
                token: active.token,
                profile: active.profile || {},
                browserSessionId: active.browserSessionId,
                serverSessionId: active.serverSessionId,
                sessionCreatedAt: active.sessionCreatedAt,
            });
            return;
        }

        if (payload.type === 'SESSION_ESTABLISHED' && isKnownPortalName(payload.portalName)) {
            if (!payload.token) return;

            const previous = getTabPortalSession();
            const session = writePortalSessionToTab({
                portalName: payload.portalName,
                token: payload.token,
                profile: payload.profile || {},
                browserSessionId: payload.browserSessionId || '',
                serverSessionId: payload.serverSessionId || null,
                createdAt: payload.sessionCreatedAt || Date.now(),
            });
            if (!session) return;

            const currentPath = window.location.pathname || '';
            const currentPortal = getPortalNameFromPath(currentPath);

            // Public pages may learn/store the shared browser session, but a
            // login in another tab must not hijack unrelated public navigation.
            if (!currentPortal) {
                if (currentPath === '/login') {
                    window.location.replace(session.redirectPath);
                }
                return;
            }

            if (currentPortal !== session.portalName) {
                window.location.replace(session.redirectPath);
                return;
            }

            if (
                previous?.token !== session.token ||
                previous?.browserSessionId !== session.browserSessionId
            ) {
                window.location.reload();
            }
            return;
        }

        if (payload.type === 'SESSION_CLEARED' && isKnownPortalName(payload.portalName)) {
            const active = getStoredPortalSession(payload.portalName);
            if (!active?.token) return;

            // Unidentified/legacy clear events are intentionally ignored. A
            // portal-wide clear cannot prove that it belongs to this tab's
            // current session and was the source of intermittent auto-logouts.
            if (!payload.token && !payload.browserSessionId) return;

            if (payload.token && active.token !== payload.token) return;

            if (
                !payload.token &&
                payload.browserSessionId &&
                active.browserSessionId !== payload.browserSessionId
            ) {
                return;
            }

            const cleared = clearPortalSession(payload.portalName, {
                expectedToken: payload.token || '',
                expectedBrowserSessionId: payload.browserSessionId || '',
            });

            if (cleared) {
                redirectPortalToLogin(payload.portalName);
            }
        }
    };

    if (portalSessionSyncChannel) {
        portalSessionSyncChannel.onmessage = (event) => {
            handleSyncPayload(event?.data || {});
        };
    }

    window.addEventListener('storage', (event) => {
        if (event.key !== PORTAL_SESSION_STORAGE_EVENT_KEY || !event.newValue) return;

        try {
            handleSyncPayload(JSON.parse(event.newValue));
        } catch {
            // Ignore malformed cross-tab events.
        }
    });
}

export function broadcastPortalSessionEstablished(session = {}) {
    const {
        portalName,
        token,
        profile,
        browserSessionId,
        serverSessionId,
        sessionCreatedAt,
    } = session;

    if (!isKnownPortalName(portalName) || !token) return null;

    const channel = portalSessionSyncChannel || createPortalSessionChannel();

    const message = publishPortalSessionMessage(
        {
            type: 'SESSION_ESTABLISHED',
            portalName,
            token,
            profile: profile || {},
            browserSessionId: browserSessionId || '',
            serverSessionId: serverSessionId || null,
            sessionCreatedAt: sessionCreatedAt || Date.now(),
        },
        channel
    );

    if (channel && channel !== portalSessionSyncChannel) {
        channel.close();
    }

    return message;
}

export function broadcastPortalSessionCleared(portalName, session = null) {
    if (!isKnownPortalName(portalName)) return null;

    const active =
        session?.token || session?.browserSessionId
            ? session
            : getStoredPortalSession(portalName);

    if (!active?.token && !active?.browserSessionId) return null;

    const channel = portalSessionSyncChannel || createPortalSessionChannel();

    const message = publishPortalSessionMessage(
        {
            type: 'SESSION_CLEARED',
            portalName,
            token: active.token || '',
            browserSessionId: active.browserSessionId || '',
            serverSessionId: active.serverSessionId || null,
        },
        channel
    );

    if (channel && channel !== portalSessionSyncChannel) {
        channel.close();
    }

    return message;
}
