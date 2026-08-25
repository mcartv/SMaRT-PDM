const supabase = require('../config/supabase');

const PORTAL_KEYS = ['admin', 'sdo', 'guidance', 'pd', 'landing'];
const PRESET_KEYS = ['default', 'forest', 'ocean', 'royal', 'sunset', 'slate', 'rose', 'midnight', 'emerald', 'crimson', 'golden', 'lavender', 'arctic', 'coral', 'mint', 'custom'];
const TABLE_NAME = 'portal_theme_settings';
const PERSONAL_TABLE_NAME = 'staff_portal_theme_settings';
const LANDING_COLOR_KEYS = ['dark', 'base', 'heroEnd', 'accent', 'danger', 'soft', 'border', 'pageBg'];
const STAFF_COLOR_KEYS = ['base', 'active', 'mainBg', 'accent', 'accentSoft', 'chartPrimary', 'chartSecondary', 'chartTertiary', 'chartQuaternary'];

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

function buildFallbackSetting(portalKey, extra = {}) {
  return {
    portal_key: portalKey,
    preset_key: 'default',
    custom_colors: null,
    updated_at: null,
    updated_by_user_id: null,
    is_fallback: true,
    is_personal: false,
    ...extra,
  };
}

function isValidHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '').trim());
}

function sanitizeCustomColors(customColors = null) {
  if (!customColors || typeof customColors !== 'object' || Array.isArray(customColors)) {
    return null;
  }

  const nextColors = {};

  LANDING_COLOR_KEYS.forEach((key) => {
    const value = customColors[key];
    if (isValidHexColor(value)) {
      nextColors[key] = String(value).trim();
    }
  });

  return Object.keys(nextColors).length ? nextColors : null;
}

function sanitizeStaffCustomColors(customColors = null) {
  if (!customColors || typeof customColors !== 'object' || Array.isArray(customColors)) {
    return null;
  }

  const nextColors = {};
  STAFF_COLOR_KEYS.forEach((key) => {
    const value = customColors[key];
    if (isValidHexColor(value)) {
      nextColors[key] = String(value).trim();
    }
  });

  return STAFF_COLOR_KEYS.every((key) => nextColors[key]) ? nextColors : null;
}

function isMissingTableError(error, tableName) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  const normalizedTable = String(tableName || '').trim().toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    (message.includes('relation') && message.includes(normalizedTable)) ||
    (message.includes('could not find the table') && message.includes(normalizedTable)) ||
    (message.includes('schema cache') && message.includes(normalizedTable))
  );
}

async function getPublicThemeSetting(portalKey) {
  const normalizedPortal = validatePortalKey(portalKey);

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('portal_key, preset_key, custom_colors, updated_at, updated_by_user_id')
    .eq('portal_key', normalizedPortal)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, TABLE_NAME)) {
      return buildFallbackSetting(normalizedPortal);
    }
    throw error;
  }

  return data
    ? { ...data, is_personal: false }
    : buildFallbackSetting(normalizedPortal);
}

function getActorUserId(actor = {}) {
  return actor.userId || actor.user_id || actor.id || null;
}

function canAccessPersonalPortal(actorRole, portalKey) {
  return portalKey !== 'landing' && actorRole === portalKey;
}

async function getPersonalThemeSetting(portalKey, actor = {}) {
  const normalizedPortal = validatePortalKey(portalKey);
  const actorRole = normalizePortalKey(actor.role);
  const actorUserId = getActorUserId(actor);

  if (normalizedPortal === 'landing') {
    if (actorRole !== 'admin') {
      throw createHttpError(403, 'Access denied for this theme setting.');
    }
    return getPublicThemeSetting(normalizedPortal);
  }

  if (!canAccessPersonalPortal(actorRole, normalizedPortal)) {
    throw createHttpError(403, 'Access denied for this personal theme.');
  }
  if (!actorUserId) {
    throw createHttpError(401, 'A valid staff session is required.');
  }

  const fallback = await getPublicThemeSetting(normalizedPortal);
  const { data, error } = await supabase
    .from(PERSONAL_TABLE_NAME)
    .select('user_id, portal_key, preset_key, custom_colors, updated_at')
    .eq('user_id', actorUserId)
    .eq('portal_key', normalizedPortal)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, PERSONAL_TABLE_NAME)) {
      return { ...fallback, personal_table_missing: true };
    }
    throw error;
  }

  return data
    ? { ...data, is_personal: true, is_fallback: false }
    : { ...fallback, user_id: actorUserId };
}

async function getThemeSettings(actor = {}) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('portal_key, preset_key, custom_colors, updated_at, updated_by_user_id');

  if (error) {
    if (isMissingTableError(error, TABLE_NAME)) {
      return {
        items: PORTAL_KEYS.map(buildFallbackSetting),
      };
    }
    throw error;
  }

  const byPortal = new Map((data || []).map((item) => [
    normalizePortalKey(item.portal_key),
    { ...item, is_personal: false },
  ]));
  const actorRole = normalizePortalKey(actor.role);

  if (PORTAL_KEYS.includes(actorRole) && actorRole !== 'landing') {
    const personalSetting = await getPersonalThemeSetting(actorRole, actor);
    byPortal.set(actorRole, personalSetting);
  }

  return {
    items: PORTAL_KEYS.map((portalKey) => byPortal.get(portalKey) || buildFallbackSetting(portalKey)),
  };
}

function canManagePortal(actorRole, portalKey) {
  if (portalKey === 'landing') return actorRole === 'admin';
  return actorRole === portalKey;
}

async function updateThemeSetting(portalKey, presetKey, actor = {}, customColors = null) {
  const normalizedPortal = validatePortalKey(portalKey);
  const normalizedPreset = validatePresetKey(presetKey);
  const actorRole = normalizePortalKey(actor.role);
  const actorUserId = getActorUserId(actor);

  if (!canManagePortal(actorRole, normalizedPortal)) {
    throw createHttpError(403, 'Access denied for this theme setting.');
  }

  const sanitizedCustomColors =
    normalizedPortal === 'landing' && normalizedPreset === 'custom'
      ? sanitizeCustomColors(customColors)
      : normalizedPortal !== 'landing' && normalizedPreset === 'custom'
        ? sanitizeStaffCustomColors(customColors)
        : null;

  if (normalizedPortal === 'landing' && normalizedPreset === 'custom' && !sanitizedCustomColors) {
    throw createHttpError(400, 'Custom landing colors are required.');
  }
  if (normalizedPortal !== 'landing' && normalizedPreset === 'custom' && !sanitizedCustomColors) {
    throw createHttpError(400, 'Complete custom portal colors are required.');
  }

  const payload = {
    portal_key: normalizedPortal,
    preset_key: normalizedPreset,
    custom_colors: sanitizedCustomColors,
    updated_at: new Date().toISOString(),
  };

  if (normalizedPortal === 'landing') {
    payload.updated_by_user_id = actorUserId;
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .upsert(payload, { onConflict: 'portal_key' })
      .select('portal_key, preset_key, custom_colors, updated_at, updated_by_user_id')
      .single();

    if (error) {
      if (isMissingTableError(error, TABLE_NAME)) {
        throw createHttpError(500, 'Theme settings table is missing. Please run the portal theme settings migration first.');
      }
      throw error;
    }

    return { ...data, is_personal: false };
  }

  if (!actorUserId) {
    throw createHttpError(401, 'A valid staff session is required.');
  }

  const personalPayload = {
    user_id: actorUserId,
    portal_key: normalizedPortal,
    preset_key: normalizedPreset,
    custom_colors: sanitizedCustomColors,
    updated_at: payload.updated_at,
  };

  const { data, error } = await supabase
    .from(PERSONAL_TABLE_NAME)
    .upsert(personalPayload, { onConflict: 'user_id,portal_key' })
    .select('user_id, portal_key, preset_key, custom_colors, updated_at')
    .single();

  if (error) {
    if (isMissingTableError(error, PERSONAL_TABLE_NAME)) {
      throw createHttpError(
        500,
        'Personal theme settings table is missing. Please run the staff portal theme settings migration first.'
      );
    }
    throw error;
  }

  return { ...data, is_personal: true };
}

module.exports = {
  PORTAL_KEYS,
  PRESET_KEYS,
  getPublicThemeSetting,
  getPersonalThemeSetting,
  getThemeSettings,
  updateThemeSetting,
};
