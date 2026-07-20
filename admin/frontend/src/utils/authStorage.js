const DEVICE_ID_KEY = 'smartpdmAdminDeviceId';

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
};

const AUTH_STORAGE_KEYS = Object.values(PORTAL_CONFIG).flatMap((portal) => [
    portal.tokenKey,
    portal.profileKey,
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
}

export function clearPortalSession(portalName) {
    const portal = PORTAL_CONFIG[portalName];
    if (!portal) return;

    [portal.tokenKey, portal.profileKey].forEach((key) => {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
    });
}

export function savePortalSession({ portalName, token, user, stayLoggedIn }) {
    const portal = PORTAL_CONFIG[portalName];

    if (!portal) {
        throw new Error(`Unknown portal: ${portalName}`);
    }

    clearAuthStorage();

    const profileJson = JSON.stringify(user || {});

    sessionStorage.setItem(portal.tokenKey, token);
    sessionStorage.setItem(portal.profileKey, profileJson);

    if (stayLoggedIn) {
        localStorage.setItem(portal.tokenKey, token);
        localStorage.setItem(portal.profileKey, profileJson);
    }
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
