'use strict';

/**
 * Process-wide cache for Supabase Storage signed download URLs.
 *
 * Why this exists:
 * Several SMaRT-PDM services serialize lists containing private Storage files.
 * Without a shared cache, every refresh can call createSignedUrl again for the
 * same object, producing Storage POST /object/sign storms.
 *
 * Scope:
 * - createSignedUrl: cached + in-flight deduplicated
 * - createSignedUrls: cached + in-flight deduplicated
 * - uploads/downloads/removes/moves/copies: untouched
 * - createSignedUploadUrl: intentionally untouched
 *
 * This is an in-memory optimization. A process restart starts with a cold cache.
 */

const MAX_ENTRIES = Math.max(
    500,
    Number(process.env.SIGNED_URL_GLOBAL_CACHE_MAX_ENTRIES || 10000)
);

const MAX_TTL_MS = Math.max(
    60 * 1000,
    Number(process.env.SIGNED_URL_GLOBAL_CACHE_MAX_TTL_MS || 6 * 60 * 60 * 1000)
);

const EXPIRY_SAFETY_MS = Math.max(
    30 * 1000,
    Number(process.env.SIGNED_URL_GLOBAL_CACHE_SAFETY_MS || 5 * 60 * 1000)
);

const cache = new Map();
const inFlight = new Map();

function stableSerialize(value) {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value !== 'object') return JSON.stringify(value);

    if (Array.isArray(value)) {
        return `[${value.map(stableSerialize).join(',')}]`;
    }

    return `{${Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
        .join(',')}}`;
}

function getCacheTtlMs(expiresInSeconds) {
    const requestedMs = Math.max(0, Number(expiresInSeconds || 0) * 1000);

    // Never reuse a URL into its expiry safety window.
    const reusableMs = Math.max(
        30 * 1000,
        requestedMs - Math.min(EXPIRY_SAFETY_MS, Math.floor(requestedMs * 0.25))
    );

    return Math.min(MAX_TTL_MS, reusableMs);
}

function prune(now = Date.now()) {
    for (const [key, entry] of cache.entries()) {
        if (!entry || entry.expiresAt <= now) {
            cache.delete(key);
        }
    }

    while (cache.size > MAX_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey === undefined) break;
        cache.delete(oldestKey);
    }
}

function readCache(key, now = Date.now()) {
    const entry = cache.get(key);

    if (!entry || entry.expiresAt <= now) {
        if (entry) cache.delete(key);
        return null;
    }

    // Refresh insertion order for basic LRU behavior.
    cache.delete(key);
    cache.set(key, entry);
    return entry.value;
}

function writeCache(key, value, ttlMs, now = Date.now()) {
    cache.set(key, {
        value,
        expiresAt: now + ttlMs,
    });
    prune(now);
}

function isSuccessfulSignedUrlResponse(result) {
    return Boolean(result && !result.error && result.data && result.data.signedUrl);
}

function isSuccessfulSignedUrlsResponse(result) {
    return Boolean(
        result &&
        !result.error &&
        Array.isArray(result.data) &&
        result.data.length > 0
    );
}

function installStorageSignedUrlCache(supabase, { label = 'supabase' } = {}) {
    if (!supabase?.storage?.from || supabase.storage.__signedUrlCacheInstalled) {
        return supabase;
    }

    const originalFrom = supabase.storage.from.bind(supabase.storage);

    supabase.storage.from = function cachedStorageFrom(bucketName) {
        const bucket = String(bucketName || '');
        const fileApi = originalFrom(bucketName);

        if (!fileApi || fileApi.__signedUrlCacheWrapped) {
            return fileApi;
        }

        Object.defineProperty(fileApi, '__signedUrlCacheWrapped', {
            value: true,
            enumerable: false,
            configurable: false,
        });

        if (typeof fileApi.createSignedUrl === 'function') {
            const originalCreateSignedUrl =
                fileApi.createSignedUrl.bind(fileApi);

            fileApi.createSignedUrl = async function cachedCreateSignedUrl(
                path,
                expiresIn,
                options
            ) {
                const normalizedPath = String(path || '').replace(/^\/+/, '');
                const key = [
                    'single',
                    bucket,
                    normalizedPath,
                    Number(expiresIn || 0),
                    stableSerialize(options),
                ].join('|');

                const now = Date.now();
                const cached = readCache(key, now);
                if (cached) return cached;

                if (inFlight.has(key)) {
                    return inFlight.get(key);
                }

                const request = (async () => {
                    const result = await originalCreateSignedUrl(
                        path,
                        expiresIn,
                        options
                    );

                    if (isSuccessfulSignedUrlResponse(result)) {
                        writeCache(
                            key,
                            result,
                            getCacheTtlMs(expiresIn),
                            now
                        );
                    }

                    return result;
                })();

                inFlight.set(key, request);

                try {
                    return await request;
                } finally {
                    inFlight.delete(key);
                }
            };
        }

        if (typeof fileApi.createSignedUrls === 'function') {
            const originalCreateSignedUrls =
                fileApi.createSignedUrls.bind(fileApi);

            fileApi.createSignedUrls = async function cachedCreateSignedUrls(
                paths,
                expiresIn,
                options
            ) {
                const normalizedPaths = Array.isArray(paths)
                    ? paths.map((path) => String(path || '').replace(/^\/+/, ''))
                    : [];

                const key = [
                    'batch',
                    bucket,
                    stableSerialize(normalizedPaths),
                    Number(expiresIn || 0),
                    stableSerialize(options),
                ].join('|');

                const now = Date.now();
                const cached = readCache(key, now);
                if (cached) return cached;

                if (inFlight.has(key)) {
                    return inFlight.get(key);
                }

                const request = (async () => {
                    const result = await originalCreateSignedUrls(
                        paths,
                        expiresIn,
                        options
                    );

                    if (isSuccessfulSignedUrlsResponse(result)) {
                        writeCache(
                            key,
                            result,
                            getCacheTtlMs(expiresIn),
                            now
                        );
                    }

                    return result;
                })();

                inFlight.set(key, request);

                try {
                    return await request;
                } finally {
                    inFlight.delete(key);
                }
            };
        }

        return fileApi;
    };

    Object.defineProperty(supabase.storage, '__signedUrlCacheInstalled', {
        value: true,
        enumerable: false,
        configurable: false,
    });

    console.log('[Storage Signed URL Cache]', {
        client: label,
        maxEntries: MAX_ENTRIES,
        maxTtlMinutes: Math.round(MAX_TTL_MS / 60000),
        expirySafetyMinutes: Math.round(EXPIRY_SAFETY_MS / 60000),
    });

    return supabase;
}

module.exports = {
    installStorageSignedUrlCache,
};
