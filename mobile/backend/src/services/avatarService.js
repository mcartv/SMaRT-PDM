// SMaRT-PDM: avatar Service — avatar Service (mobile backend service); contains mobile-facing business logic and data operations.
const supabase = require('../config/supabase');
const AVATAR_BUCKET = 'avatars';
const AVATAR_SIGNED_URL_CACHE_TTL_MS = Math.max(
  60 * 1000,
  Number(process.env.AVATAR_SIGNED_URL_CACHE_TTL_MS || 6 * 60 * 60 * 1000)
);
const AVATAR_SIGNED_URL_CACHE_MAX_ENTRIES = Math.max(
  100,
  Number(process.env.AVATAR_SIGNED_URL_CACHE_MAX_ENTRIES || 1000)
);
const avatarSignedUrlCache = new Map();
const avatarSignedUrlInFlight = new Map();

// pruneAvatarSignedUrlCache: handles prune avatar signed url cache for the avatar Service flow.
function pruneAvatarSignedUrlCache(now = Date.now()) {
  for (const [key, entry] of avatarSignedUrlCache.entries()) {
    if (!entry || entry.expiresAt <= now) avatarSignedUrlCache.delete(key);
  }
  while (avatarSignedUrlCache.size > AVATAR_SIGNED_URL_CACHE_MAX_ENTRIES) {
    const oldestKey = avatarSignedUrlCache.keys().next().value;
    if (oldestKey === undefined) break;
    avatarSignedUrlCache.delete(oldestKey);
  }
}
const AVATAR_BUCKET_CONFIG = {
  public: false,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ],
};

// normalizeValue: normalizes normalize value for the avatar Service flow.
function normalizeValue(value) {
  return value == null ? '' : String(value).trim();
}

// isBucketMissingError: checks whether is bucket missing error for the avatar Service flow.
function isBucketMissingError(error) {
  const statusCode = Number.parseInt(error?.statusCode, 10);
  const status = Number.parseInt(error?.status, 10);
  const message = normalizeValue(error?.message).toLowerCase();

  return (
    statusCode === 404 ||
    status === 404 ||
    message.includes('bucket not found')
  );
}

// isBucketAlreadyExistsError: checks whether is bucket already exists error for the avatar Service flow.
function isBucketAlreadyExistsError(error) {
  return normalizeValue(error?.message)
    .toLowerCase()
    .includes('already exists');
}

// extractAvatarStoragePath: handles extract avatar storage path for the avatar Service flow.
function extractAvatarStoragePath(value) {
  const rawValue = normalizeValue(value);
  if (!rawValue) return null;

  if (!/^https?:\/\//i.test(rawValue)) {
    return rawValue.replace(/^avatars\//, '');
  }

  const markers = [
    '/storage/v1/object/public/avatars/',
    '/storage/v1/object/sign/avatars/',
    '/storage/v1/object/authenticated/avatars/',
  ];

  for (const marker of markers) {
    const markerIndex = rawValue.indexOf(marker);
    if (markerIndex >= 0) {
      return rawValue.slice(markerIndex + marker.length).split('?')[0];
    }
  }

  return null;
}

// resolveAvatarUrl: resolves resolve avatar url for the avatar Service flow.
async function resolveAvatarUrl(value) {
  const rawValue = normalizeValue(value);
  if (!rawValue) return null;

  const storagePath = extractAvatarStoragePath(rawValue);
  if (!storagePath) return rawValue;

  const cacheKey = storagePath.replace(/^\/+/, '');
  const now = Date.now();
  const cached = avatarSignedUrlCache.get(cacheKey);

  if (cached && cached.expiresAt > now && cached.url) {
    avatarSignedUrlCache.delete(cacheKey);
    avatarSignedUrlCache.set(cacheKey, cached);
    return cached.url;
  }

  const existingRequest = avatarSignedUrlInFlight.get(cacheKey);
  if (existingRequest) return existingRequest;

  // request: handles request for the avatar Service flow.
  const request = (async () => {
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(cacheKey, 60 * 60 * 24 * 7);

    if (error) return rawValue;

    const signedUrl = data?.signedUrl || rawValue;
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

// ensureAvatarBucketExists: ensures ensure avatar bucket exists for the avatar Service flow.
async function ensureAvatarBucketExists() {
  const { data, error } = await supabase.storage.getBucket(AVATAR_BUCKET);

  if (!error && data) {
    return;
  }

  if (error && !isBucketMissingError(error)) {
    throw error;
  }

  const { error: createError } = await supabase.storage.createBucket(
    AVATAR_BUCKET,
    AVATAR_BUCKET_CONFIG
  );

  if (createError && !isBucketAlreadyExistsError(createError)) {
    throw createError;
  }
}

module.exports = {
  AVATAR_BUCKET,
  ensureAvatarBucketExists,
  extractAvatarStoragePath,
  resolveAvatarUrl,
};
