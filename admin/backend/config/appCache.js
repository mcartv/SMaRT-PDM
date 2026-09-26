'use strict';

/**
 * SMaRT-PDM shared backend read cache.
 *
 * This cache is intentionally process-local and server-side only.
 * Authenticated/private API responses must still use Cache-Control: no-store
 * so browsers/CDNs do not become a second, uncontrolled cache.
 *
 * Use this only for idempotent, read-heavy JSON endpoints.
 * Do not use it for Auth/OTP/Sessions, Messaging, Notifications, OCR live
 * status, IoT heartbeat, Audit Trail, or binary/download endpoints.
 */

function boundedNumber(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

const MAX_ENTRIES = Math.floor(
    boundedNumber(
        process.env.APP_CACHE_MAX_ENTRIES,
        2500,
        100,
        20000
    )
);

const MAX_TTL_MS = boundedNumber(
    process.env.APP_CACHE_MAX_TTL_MS,
    5 * 60 * 1000,
    1000,
    30 * 60 * 1000
);

const store = new Map();

const REALTIME_TABLE_NAMESPACES = {
    applications: ['applications', 'program-openings', 'selection-preview'],
    application_documents: ['applications'],
    application_document_reviews: ['applications'],
    endorsement_slips: ['applications', 'endorsements', 'program-openings', 'selection-preview'],
    renewals: ['renewals', 'scholars'],
    renewal_documents: ['renewals', 'scholars'],
    program_openings: ['program-openings', 'applications', 'selection-preview'],
    scholarship_program: ['scholarship-programs', 'program-openings', 'applications'],
    benefactors: ['benefactors', 'scholarship-programs'],
    academic_years: ['academic-years', 'program-openings', 'applications'],
    academic_period: ['academic-years', 'program-openings', 'applications'],
    academic_course: ['courses', 'scholars'],
    announcements: ['announcements'],
    general_settings: ['general-settings'],
    theme_settings: ['theme-settings'],
    payout_batches: ['payouts'],
    payout_batch_students: ['payouts'],
    payout_proofs: ['payouts'],
    return_of_obligations: ['ro', 'ro-coordinator'],
    ro_time_logs: ['ro', 'ro-coordinator'],
    ro_placements: ['ro', 'ro-coordinator'],
    ro_scholar_requests: ['ro', 'ro-coordinator'],
    ro_area_coordinators: ['ro', 'ro-coordinator'],
    ro_settings: ['ro', 'ro-coordinator'],
};

function normalizeNamespace(value) {
    return String(value || 'default').trim().toLowerCase() || 'default';
}

function prune(now = Date.now()) {
    for (const [key, entry] of store.entries()) {
        if (!entry || entry.expiresAt <= now) {
            store.delete(key);
        }
    }

    while (store.size > MAX_ENTRIES) {
        const oldestKey = store.keys().next().value;
        if (oldestKey === undefined) break;
        store.delete(oldestKey);
    }
}

function buildKey({
    namespace,
    scopeKey = 'public',
    pathname = '/',
    queryKey = '',
}) {
    return [
        normalizeNamespace(namespace),
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

    // Basic LRU: a hit becomes the newest item.
    store.delete(String(key || ''));
    store.set(String(key || ''), entry);

    return {
        namespace: entry.namespace,
        statusCode: entry.statusCode,
        bodyText: entry.bodyText,
        createdAt: entry.createdAt,
        expiresAt: entry.expiresAt,
    };
}

function setJson(
    key,
    {
        namespace,
        statusCode = 200,
        body,
    },
    ttlMs,
    now = Date.now()
) {
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
        namespace: normalizeNamespace(namespace),
        statusCode: Number(statusCode || 200),
        bodyText,
        createdAt: now,
        expiresAt: now + effectiveTtl,
    });

    prune(now);
    return true;
}

function invalidateNamespaces(namespaces = []) {
    const normalized = new Set(
        (Array.isArray(namespaces) ? namespaces : [namespaces])
            .map(normalizeNamespace)
            .filter(Boolean)
    );

    if (!normalized.size) return 0;

    let removed = 0;

    for (const [key, entry] of store.entries()) {
        if (normalized.has(normalizeNamespace(entry?.namespace))) {
            store.delete(key);
            removed += 1;
        }
    }

    return removed;
}

function clearAll() {
    const count = store.size;
    store.clear();
    return count;
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

function getStats() {
    prune();

    const byNamespace = {};
    for (const entry of store.values()) {
        const namespace = normalizeNamespace(entry?.namespace);
        byNamespace[namespace] = (byNamespace[namespace] || 0) + 1;
    }

    return {
        entries: store.size,
        maxEntries: MAX_ENTRIES,
        maxTtlMs: MAX_TTL_MS,
        byNamespace,
    };
}

module.exports = {
    MAX_ENTRIES,
    MAX_TTL_MS,
    buildKey,
    getJson,
    setJson,
    invalidateNamespaces,
    clearAll,
    installSupabaseRealtimeInvalidation,
    getStats,
};
