// Extracted avatar path/url helpers
function extractAvatarStoragePath(value) {
  const rawValue = (value ?? '').toString().trim();
  if (!rawValue) return null;

  if (!rawValue.startsWith('http')) {
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
      const extracted = rawValue.slice(markerIndex + marker.length);
      return extracted.split('?')[0];
    }
  }

  return null;
}

async function resolveAvatarUrl(value) {
  const rawValue = (value ?? '').toString().trim();
  if (!rawValue) return null;

  const storagePath = extractAvatarStoragePath(rawValue);
  if (!storagePath) {
    return rawValue;
  }

  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  if (error) {
    console.warn('Avatar signed URL generation failed:', error.message);
    return rawValue;
  }

  return data?.signedUrl ?? rawValue;
}
