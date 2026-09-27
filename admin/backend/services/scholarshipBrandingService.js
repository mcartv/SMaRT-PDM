const path = require('path');
const supabase = require('../config/supabase');

const BUCKET = 'scholarship-branding';
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
]);

const ENTITY_CONFIG = {
  benefactor: {
    table: 'benefactors',
    idColumn: 'benefactor_id',
    folder: 'benefactors',
  },
  program: {
    table: 'scholarship_program',
    idColumn: 'program_id',
    folder: 'programs',
  },
};

const SLOT_CONFIG = {
  'admin-logo': {
    urlColumn: 'admin_logo_url',
    pathColumn: 'admin_logo_path',
    filename: 'admin-logo',
  },
  'landing-image': {
    urlColumn: 'landing_image_url',
    pathColumn: 'landing_image_path',
    filename: 'landing-image',
  },
};

function validateFile(file) {
  if (!file?.buffer?.length) {
    const error = new Error('Image file is required');
    error.statusCode = 400;
    throw error;
  }

  if (file.size > MAX_IMAGE_BYTES) {
    const error = new Error('Image must be 3 MB or smaller');
    error.statusCode = 400;
    throw error;
  }

  if (!ALLOWED_TYPES.has(file.mimetype)) {
    const error = new Error('Only PNG, JPG, and WEBP images are supported');
    error.statusCode = 400;
    throw error;
  }
}

async function ensureBucket() {
  const { data, error } = await supabase.storage.getBucket(BUCKET);
  if (!error && data) return;

  const message = String(error?.message || '').toLowerCase();
  if (message && !message.includes('not found')) {
    throw new Error(error.message);
  }

  const created = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_IMAGE_BYTES,
    allowedMimeTypes: [...ALLOWED_TYPES.keys()],
  });

  if (created.error && !String(created.error.message || '').toLowerCase().includes('already exists')) {
    throw new Error(created.error.message);
  }
}

function resolveConfig(entityType, slot) {
  const entity = ENTITY_CONFIG[entityType];
  const brandingSlot = SLOT_CONFIG[slot];

  if (!entity || !brandingSlot) {
    const error = new Error('Unsupported scholarship branding target');
    error.statusCode = 400;
    throw error;
  }

  return { entity, brandingSlot };
}

async function getCurrentRow(entity, entityId, brandingSlot) {
  const { data, error } = await supabase
    .from(entity.table)
    .select(`${entity.idColumn}, ${brandingSlot.urlColumn}, ${brandingSlot.pathColumn}`)
    .eq(entity.idColumn, entityId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    const notFound = new Error('Scholarship branding record not found');
    notFound.statusCode = 404;
    throw notFound;
  }

  return data;
}

async function uploadBrandingImage({ entityType, entityId, slot, file }) {
  validateFile(file);
  const { entity, brandingSlot } = resolveConfig(entityType, slot);
  const current = await getCurrentRow(entity, entityId, brandingSlot);
  await ensureBucket();

  const extension = ALLOWED_TYPES.get(file.mimetype) || path.extname(file.originalname || '') || '.jpg';
  const objectPath = `${entity.folder}/${entityId}/${brandingSlot.filename}-${Date.now()}${extension}`;

  const uploaded = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploaded.error) throw new Error(uploaded.error.message);

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(objectPath)?.data?.publicUrl || null;
  if (!publicUrl) {
    await supabase.storage.from(BUCKET).remove([objectPath]).catch(() => null);
    throw new Error('Unable to create scholarship branding image URL');
  }

  const update = {
    [brandingSlot.urlColumn]: publicUrl,
    [brandingSlot.pathColumn]: objectPath,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(entity.table)
    .update(update)
    .eq(entity.idColumn, entityId)
    .select('*')
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([objectPath]).catch(() => null);
    throw new Error(error.message);
  }

  const oldPath = current?.[brandingSlot.pathColumn];
  if (oldPath && oldPath !== objectPath) {
    await supabase.storage.from(BUCKET).remove([oldPath]).catch(() => null);
  }

  return data;
}

async function removeBrandingImage({ entityType, entityId, slot }) {
  const { entity, brandingSlot } = resolveConfig(entityType, slot);
  const current = await getCurrentRow(entity, entityId, brandingSlot);

  const { data, error } = await supabase
    .from(entity.table)
    .update({
      [brandingSlot.urlColumn]: null,
      [brandingSlot.pathColumn]: null,
      updated_at: new Date().toISOString(),
    })
    .eq(entity.idColumn, entityId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  const oldPath = current?.[brandingSlot.pathColumn];
  if (oldPath) {
    await supabase.storage.from(BUCKET).remove([oldPath]).catch(() => null);
  }

  return data;
}

module.exports = {
  BUCKET,
  MAX_IMAGE_BYTES,
  uploadBrandingImage,
  removeBrandingImage,
};
