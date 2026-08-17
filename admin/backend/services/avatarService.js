const supabase = require('../config/supabase');

const AVATAR_BUCKET = 'avatars';

const AVATAR_SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
const AVATAR_SIGNED_URL_CACHE_TTL_MS = Math.max(
  60 * 1000,
  Number(process.env.AVATAR_SIGNED_URL_CACHE_TTL_MS || 6 * 60 * 60 * 1000)
);
const AVATAR_SIGNED_URL_CACHE_MAX_ENTRIES = Math.max(
  100,
  Number(process.env.AVATAR_SIGNED_URL_CACHE_MAX_ENTRIES || 1000)
);
const AVATAR_SIGNED_URL_CACHE_DEBUG =
  String(process.env.AVATAR_SIGNED_URL_CACHE_DEBUG || '')
    .trim()
    .toLowerCase() === 'true';

const avatarSignedUrlCache = new Map();
const avatarSignedUrlInFlight = new Map();

function normalizeValue(value) {
  return value == null ? '' : String(value).trim();
}

function extractAvatarStoragePath(value) {
  const rawValue = normalizeValue(value);
  if (!rawValue) return null;

  if (!/^https?:\/\//i.test(rawValue)) {
    return rawValue.replace(/^avatars\//, '').replace(/^\/+/, '');
  }

  const markers = [
    '/storage/v1/object/public/avatars/',
    '/storage/v1/object/sign/avatars/',
    '/storage/v1/object/authenticated/avatars/',
  ];

  for (const marker of markers) {
    const markerIndex = rawValue.indexOf(marker);
    if (markerIndex >= 0) {
      return decodeURIComponent(
        rawValue.slice(markerIndex + marker.length).split('?')[0]
      ).replace(/^\/+/, '');
    }
  }

  return null;
}

function pruneAvatarSignedUrlCache(now = Date.now()) {
  for (const [key, entry] of avatarSignedUrlCache.entries()) {
    if (!entry || !entry.url || entry.expiresAt <= now) {
      avatarSignedUrlCache.delete(key);
    }
  }

  while (avatarSignedUrlCache.size > AVATAR_SIGNED_URL_CACHE_MAX_ENTRIES) {
    const oldestKey = avatarSignedUrlCache.keys().next().value;
    if (oldestKey === undefined) break;
    avatarSignedUrlCache.delete(oldestKey);
  }
}

function debugAvatarCache(kind, cacheKey) {
  if (!AVATAR_SIGNED_URL_CACHE_DEBUG) return;

  console.log(`[Admin Avatar Signed URL Cache] ${kind}`, {
    key: cacheKey,
    size: avatarSignedUrlCache.size,
  });
}

async function resolveAvatarUrl(value) {
  const rawValue = normalizeValue(value);
  if (!rawValue) return null;

  const storagePath = extractAvatarStoragePath(rawValue);
  if (!storagePath) {
    return rawValue;
  }

  const cacheKey = storagePath;
  const now = Date.now();
  const cached = avatarSignedUrlCache.get(cacheKey);

  if (cached && cached.expiresAt > now && cached.url) {
    avatarSignedUrlCache.delete(cacheKey);
    avatarSignedUrlCache.set(cacheKey, cached);
    debugAvatarCache('HIT', cacheKey);
    return cached.url;
  }

  const inFlight = avatarSignedUrlInFlight.get(cacheKey);
  if (inFlight) {
    debugAvatarCache('IN_FLIGHT', cacheKey);
    return inFlight;
  }

  const request = (async () => {
    debugAvatarCache('MISS', cacheKey);

    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(cacheKey, AVATAR_SIGNED_URL_EXPIRES_IN_SECONDS);

    if (error) {
      console.warn('[Admin Avatar Signed URL] signing failed', {
        path: cacheKey,
        message: error.message,
      });
      return rawValue;
    }

    const signedUrl = normalizeValue(data?.signedUrl);
    if (!signedUrl) {
      return rawValue;
    }

    avatarSignedUrlCache.set(cacheKey, {
      url: signedUrl,
      expiresAt: Date.now() + AVATAR_SIGNED_URL_CACHE_TTL_MS,
    });
    pruneAvatarSignedUrlCache();

    return signedUrl;
  })();

  avatarSignedUrlInFlight.set(cacheKey, request);

  try {
    return await request;
  } finally {
    avatarSignedUrlInFlight.delete(cacheKey);
  }
}

function clearAvatarSignedUrlCache(storagePath = null) {
  const normalizedPath = extractAvatarStoragePath(storagePath);

  if (normalizedPath) {
    avatarSignedUrlCache.delete(normalizedPath);
    avatarSignedUrlInFlight.delete(normalizedPath);
    return;
  }

  avatarSignedUrlCache.clear();
  avatarSignedUrlInFlight.clear();
}

module.exports = {
  extractAvatarStoragePath,
  resolveAvatarUrl,
  clearAvatarSignedUrlCache,
};
