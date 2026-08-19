const supabase = require('../config/supabase');
const AVATAR_BUCKET = 'avatars';
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

function normalizeValue(value) {
  return value == null ? '' : String(value).trim();
}

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

function isBucketAlreadyExistsError(error) {
  return normalizeValue(error?.message)
    .toLowerCase()
    .includes('already exists');
}

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

async function resolveAvatarUrl(value) {
  const rawValue = normalizeValue(value);
  if (!rawValue) return null;

  const storagePath = extractAvatarStoragePath(rawValue);
  if (!storagePath) {
    return rawValue;
  }

  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  if (error) {
    return rawValue;
  }

  return data?.signedUrl || rawValue;
}

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
