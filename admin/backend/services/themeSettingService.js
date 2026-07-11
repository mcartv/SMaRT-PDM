const supabase = require('../config/supabase');

const PORTAL_KEYS = ['admin', 'sdo', 'guidance', 'pd'];
const PRESET_KEYS = ['default', 'forest', 'ocean', 'royal', 'sunset', 'slate'];
const TABLE_NAME = 'portal_theme_settings';

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizePortalKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePresetKey(value) {
  return String(value || '').trim().toLowerCase();
}

function validatePortalKey(portalKey) {
  const normalized = normalizePortalKey(portalKey);
  if (!PORTAL_KEYS.includes(normalized)) {
    throw createHttpError(400, 'Invalid portal key.');
  }
  return normalized;
}

function validatePresetKey(presetKey) {
  const normalized = normalizePresetKey(presetKey);
  if (!PRESET_KEYS.includes(normalized)) {
    throw createHttpError(400, 'Invalid theme preset.');
  }
  return normalized;
}

function buildFallbackSetting(portalKey) {
  return {
    portal_key: portalKey,
    preset_key: 'default',
    updated_at: null,
    updated_by_user_id: null,
    is_fallback: true,
  };
}

function isMissingTableError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    message.includes('relation') && message.includes('portal_theme_settings') ||
    message.includes('could not find the table') && message.includes('portal_theme_settings') ||
    message.includes('schema cache') && message.includes('portal_theme_settings')
  );
}

async function getPublicThemeSetting(portalKey) {
  const normalizedPortal = validatePortalKey(portalKey);

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('portal_key, preset_key, updated_at, updated_by_user_id')
    .eq('portal_key', normalizedPortal)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return buildFallbackSetting(normalizedPortal);
    }
    throw error;
  }

  return data || buildFallbackSetting(normalizedPortal);
}

async function getThemeSettings() {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('portal_key, preset_key, updated_at, updated_by_user_id');

  if (error) {
    if (isMissingTableError(error)) {
      return {
        items: PORTAL_KEYS.map(buildFallbackSetting),
      };
    }
    throw error;
  }

  const byPortal = new Map((data || []).map((item) => [normalizePortalKey(item.portal_key), item]));
  return {
    items: PORTAL_KEYS.map((portalKey) => byPortal.get(portalKey) || buildFallbackSetting(portalKey)),
  };
}

function canManagePortal(actorRole, portalKey) {
  if (actorRole === 'admin') return true;
  return actorRole === portalKey;
}

async function updateThemeSetting(portalKey, presetKey, actor = {}) {
  const normalizedPortal = validatePortalKey(portalKey);
  const normalizedPreset = validatePresetKey(presetKey);
  const actorRole = normalizePortalKey(actor.role);

  if (!canManagePortal(actorRole, normalizedPortal)) {
    throw createHttpError(403, 'Access denied for this theme setting.');
  }

  const payload = {
    portal_key: normalizedPortal,
    preset_key: normalizedPreset,
    updated_by_user_id: actor.userId || actor.user_id || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(payload, { onConflict: 'portal_key' })
    .select('portal_key, preset_key, updated_at, updated_by_user_id')
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      throw createHttpError(
        500,
        'Theme settings table is missing. Please run the portal theme settings migration first.'
      );
    }
    throw error;
  }

  return data;
}

module.exports = {
  PORTAL_KEYS,
  PRESET_KEYS,
  getPublicThemeSetting,
  getThemeSettings,
  updateThemeSetting,
};
