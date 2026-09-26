'use strict';

const appCache = require('../config/appCache');

function normalizedQuery(query = {}) {
    return Object.keys(query || {})
        .filter((key) => !['refresh', 'fresh', '_', 'cacheBust'].includes(key))
        .sort()
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(query[key] ?? ''))}`)
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

function scopeKey(req, scope) {
    if (scope === 'public') return 'public';
    return `user:${getUserId(req) || 'unknown'}:${getRole(req) || 'unknown'}`;
}

function shouldRefresh(req) {
    return ['1', 'true', 'yes', 'on'].includes(
        String(req.query?.refresh || req.query?.fresh || '')
            .trim()
            .toLowerCase()
    );
}

function setHeaders(res, status) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-SMaRT-Cache', status);
    res.vary('Authorization');
}

function cacheJsonResponse({ namespace, ttlMs = 5000, scope = 'user' } = {}) {
    if (!namespace) throw new Error('cacheJsonResponse requires a namespace.');

    return function mobileCacheMiddleware(req, res, next) {
        if (req.method !== 'GET') return next();

        const key = appCache.buildKey({
            namespace,
            scopeKey: scopeKey(req, scope),
            pathname: `${req.baseUrl || ''}${req.path || ''}`,
            queryKey: normalizedQuery(req.query || {}),
        });

        const refresh = shouldRefresh(req);

        if (!refresh) {
            const cached = appCache.getJson(key);
            if (cached) {
                setHeaders(res, 'HIT');
                res.status(cached.statusCode);
                res.type('application/json; charset=utf-8');
                return res.send(cached.bodyText);
            }
        }

        setHeaders(res, refresh ? 'REFRESH' : 'MISS');

        const originalJson = res.json.bind(res);
        res.json = function cachedJson(body) {
            const statusCode = Number(res.statusCode || 200);

            if (
                statusCode >= 200 &&
                statusCode < 300 &&
                !res.getHeader('Set-Cookie')
            ) {
                appCache.setJson(
                    key,
                    { namespace, statusCode, body },
                    ttlMs
                );
            }

            return originalJson(body);
        };

        return next();
    };
}

function invalidateCacheOnSuccess(namespaces = []) {
    const selected = Array.isArray(namespaces) ? namespaces : [namespaces];

    return function mobileCacheInvalidation(req, res, next) {
        res.once('finish', () => {
            if (res.statusCode >= 200 && res.statusCode < 400) {
                appCache.invalidateNamespaces(selected);
            }
        });
        return next();
    };
}

module.exports = {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
};
