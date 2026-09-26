'use strict';

const appCache = require('../config/appCache');

function normalizeQuery(query = {}) {
    return Object.keys(query || {})
        .filter((key) => !['refresh', 'fresh', '_', 'cacheBust'].includes(key))
        .sort()
        .map((key) => {
            const value = query[key];
            if (Array.isArray(value)) {
                return `${encodeURIComponent(key)}=${encodeURIComponent(value.join(','))}`;
            }
            return `${encodeURIComponent(key)}=${encodeURIComponent(String(value ?? ''))}`;
        })
        .join('&');
}

function getUserId(req) {
    return String(
        req.user?.user_id ||
        req.user?.userId ||
        req.user?.id ||
        ''
    ).trim();
}

function getRole(req) {
    return String(req.user?.role || '').trim().toLowerCase();
}

function resolveScopeKey(req, scope) {
    if (scope === 'public') return 'public';
    if (scope === 'role') return `role:${getRole(req) || 'unknown'}`;

    const userId = getUserId(req);
    const role = getRole(req);

    return `user:${userId || 'unknown'}:${role || 'unknown'}`;
}

function shouldRefresh(req) {
    const queryRefresh = ['1', 'true', 'yes', 'on'].includes(
        String(req.query?.refresh || req.query?.fresh || '')
            .trim()
            .toLowerCase()
    );

    const requestCacheControl = String(
        req.get?.('cache-control') ||
        req.headers?.['cache-control'] ||
        ''
    ).toLowerCase();

    const pragma = String(
        req.get?.('pragma') ||
        req.headers?.pragma ||
        ''
    ).toLowerCase();

    return (
        queryRefresh ||
        requestCacheControl.includes('no-cache') ||
        requestCacheControl.includes('no-store') ||
        requestCacheControl.includes('max-age=0') ||
        pragma.includes('no-cache')
    );
}

function addPrivateCacheHeaders(res, status) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-SMaRT-Cache', status);
    res.vary('Authorization');
}

function cacheJsonResponse({
    namespace,
    ttlMs = 5000,
    scope = 'user',
} = {}) {
    if (!namespace) {
        throw new Error('cacheJsonResponse requires a namespace.');
    }

    return function smartPdmCacheMiddleware(req, res, next) {
        if (req.method !== 'GET') return next();

        const scopeKey = resolveScopeKey(req, scope);
        const pathname = `${req.baseUrl || ''}${req.path || ''}`;
        const queryKey = normalizeQuery(req.query || {});
        const cacheKey = appCache.buildKey({
            namespace,
            scopeKey,
            pathname,
            queryKey,
        });

        const refresh = shouldRefresh(req);

        if (!refresh) {
            const cached = appCache.getJson(cacheKey);

            if (cached) {
                addPrivateCacheHeaders(res, 'HIT');
                res.setHeader(
                    'Server-Timing',
                    `appcache;desc="HIT";dur=0`
                );
                res.status(cached.statusCode);
                res.type('application/json; charset=utf-8');
                return res.send(cached.bodyText);
            }
        }

        addPrivateCacheHeaders(res, refresh ? 'REFRESH' : 'MISS');

        const originalJson = res.json.bind(res);

        res.json = function cachedJson(body) {
            const statusCode = Number(res.statusCode || 200);
            const setCookie = res.getHeader('Set-Cookie');

            if (
                statusCode >= 200 &&
                statusCode < 300 &&
                !setCookie
            ) {
                appCache.setJson(
                    cacheKey,
                    {
                        namespace,
                        statusCode,
                        body,
                    },
                    ttlMs
                );
            }

            return originalJson(body);
        };

        return next();
    };
}

function invalidateCacheOnSuccess(namespaces = []) {
    const normalized = Array.isArray(namespaces)
        ? namespaces
        : [namespaces];

    return function smartPdmCacheInvalidationMiddleware(req, res, next) {
        let handled = false;

        res.once('finish', () => {
            if (handled) return;
            handled = true;

            if (res.statusCode >= 200 && res.statusCode < 400) {
                appCache.invalidateNamespaces(normalized);
            }
        });

        return next();
    };
}

module.exports = {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
};
