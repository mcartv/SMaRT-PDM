'use strict';

function boundedNumber(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

const MAX_ENTRIES = Math.floor(
    boundedNumber(
        process.env.MOBILE_APP_CACHE_MAX_ENTRIES,
        1000,
        100,
        10000
    )
);

const MAX_TTL_MS = boundedNumber(
    process.env.MOBILE_APP_CACHE_MAX_TTL_MS,
    2 * 60 * 1000,
    1000,
    10 * 60 * 1000
);

const store = new Map();

const REALTIME_TABLE_NAMESPACES = {
    announcements: ['mobile-announcements'],
    program_openings: ['mobile-openings'],
    scholarship_program: ['mobile-scholarship-programs'],
    general_settings: ['mobile-general-settings', 'mobile-faqs'],
};

function namespaceOf(value) {
    return String(value || 'default').trim().toLowerCase() || 'default';
}

function prune(now = Date.now()) {
    for (const [key, entry] of store.entries()) {
        if (!entry || entry.expiresAt <= now) store.delete(key);
    }

    while (store.size > MAX_ENTRIES) {
        const oldestKey = store.keys().next().value;
        if (oldestKey === undefined) break;
        store.delete(oldestKey);
    }
}

function buildKey({ namespace, scopeKey, pathname, queryKey }) {
    return [
        namespaceOf(namespace),
        String(scopeKey || 'public'),
        String(pathname || '/'),
        String(queryKey || ''),
    ].join('|');
}

function getJson(key, now = Date.now()) {
    const entry = store.get(String(key || ''));

    if (!entry || entry.expiresAt <= now) {
        if (entry) store.delete(String(key || ''));
        return null;
    }

    store.delete(String(key || ''));
    store.set(String(key || ''), entry);

    return entry;
}

function setJson(key, { namespace, statusCode = 200, body }, ttlMs, now = Date.now()) {
    let bodyText;
    try {
        bodyText = JSON.stringify(body);
    } catch {
        return false;
    }

    if (bodyText === undefined) return false;

    const effectiveTtl = Math.min(
        MAX_TTL_MS,
        Math.max(1000, Number(ttlMs || 5000))
    );

    store.set(String(key || ''), {
        namespace: namespaceOf(namespace),
        statusCode: Number(statusCode || 200),
        bodyText,
        createdAt: now,
        expiresAt: now + effectiveTtl,
    });

    prune(now);
    return true;
}

function invalidateNamespaces(namespaces = []) {
    const selected = new Set(
        (Array.isArray(namespaces) ? namespaces : [namespaces])
            .map(namespaceOf)
    );

    let removed = 0;
    for (const [key, entry] of store.entries()) {
        if (selected.has(namespaceOf(entry?.namespace))) {
            store.delete(key);
            removed += 1;
        }
    }
    return removed;
}

function installSupabaseRealtimeInvalidation(supabase) {
    if (!supabase?.channel || supabase.__smartPdmCacheInvalidationInstalled) {
        return supabase;
    }

    const originalChannel = supabase.channel.bind(supabase);

    supabase.channel = function cacheAwareChannel(...args) {
        const channel = originalChannel(...args);

        if (!channel?.on || channel.__smartPdmCacheInvalidationWrapped) {
            return channel;
        }

        const originalOn = channel.on.bind(channel);

        channel.on = function cacheAwareOn(eventName, filter, handler) {
            const table = String(filter?.table || '').trim();
            const namespaces = REALTIME_TABLE_NAMESPACES[table];

            if (
                eventName === 'postgres_changes' &&
                namespaces?.length &&
                typeof handler === 'function'
            ) {
                return originalOn(eventName, filter, (payload) => {
                    invalidateNamespaces(namespaces);
                    return handler(payload);
                });
            }

            return originalOn(eventName, filter, handler);
        };

        Object.defineProperty(
            channel,
            '__smartPdmCacheInvalidationWrapped',
            {
                value: true,
                enumerable: false,
                configurable: false,
            }
        );

        return channel;
    };

    Object.defineProperty(
        supabase,
        '__smartPdmCacheInvalidationInstalled',
        {
            value: true,
            enumerable: false,
            configurable: false,
        }
    );

    return supabase;
}

function clearAll() {
    const count = store.size;
    store.clear();
    return count;
}

module.exports = {
    MAX_ENTRIES,
    MAX_TTL_MS,
    buildKey,
    getJson,
    setJson,
    invalidateNamespaces,
    installSupabaseRealtimeInvalidation,
    clearAll,
};
