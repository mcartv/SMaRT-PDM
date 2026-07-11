const supabase = require('../config/supabase');

const PORTAL_KEYS = ['admin', 'sdo', 'guidance', 'pd'];
const PRESET_KEYS = ['default', 'forest', 'ocean', 'royal', 'sunset', 'slate', 'rose', 'midnight', 'emerald', 'crimson', 'golden', 'lavender', 'arctic'];
const TABLE_NAME = 'portal_theme_settings';
const HISTORY_TABLE_NAME = 'portal_theme_history';
const HISTORY_LIMIT = 10;

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

function isMissingTableError(error, tableName) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  const normalizedTable = String(tableName || '').trim().toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    message.includes('relation') && message.includes(normalizedTable) ||
    message.includes('could not find the table') && message.includes(normalizedTable) ||
    message.includes('schema cache') && message.includes(normalizedTable)
  );
}

function buildDisplayName(profile, actor = {}) {
  const fullName = [profile?.first_name, profile?.last_name]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    fullName ||
    String(actor?.name || actor?.full_name || actor?.email || actor?.role || 'Portal user').trim()
  );
}

async function getActorDisplayName(actor = {}) {
  const actorUserId = actor.userId || actor.user_id || null;
  if (!actorUserId) {
    return buildDisplayName(null, actor);
  }

  const { data, error } = await supabase
    .from('admin_profiles')
    .select('first_name, last_name')
    .eq('user_id', actorUserId)
    .maybeSingle();

  if (error) {
    return buildDisplayName(null, actor);
  }

  return buildDisplayName(data, actor);
}

async function insertThemeHistoryEntry({
  portalKey,
  previousPresetKey,
  nextPresetKey,
  actor,
  changedAt,
}) {
  const actorUserId = actor?.userId || actor?.user_id || null;
  const actorDisplayName = await getActorDisplayName(actor);

  const { error } = await supabase
    .from(HISTORY_TABLE_NAME)
    .insert({
      portal_key: portalKey,
      previous_preset_key: previousPresetKey,
      next_preset_key: nextPresetKey,
      changed_by_user_id: actorUserId,
      changed_by_name: actorDisplayName,
      changed_at: changedAt,
    });

  if (error && !isMissingTableError(error, HISTORY_TABLE_NAME)) {
    throw error;
  }
}

async function getPublicThemeSetting(portalKey) {
  const normalizedPortal = validatePortalKey(portalKey);

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('portal_key, preset_key, updated_at, updated_by_user_id')
    .eq('portal_key', normalizedPortal)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, TABLE_NAME)) {
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
    if (isMissingTableError(error, TABLE_NAME)) {
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

async function getThemeHistory(portalKey = null) {
  const normalizedPortal = portalKey ? validatePortalKey(portalKey) : null;

  let query = supabase
    .from(HISTORY_TABLE_NAME)
    .select('history_id, portal_key, previous_preset_key, next_preset_key, changed_by_user_id, changed_by_name, changed_at')
    .order('changed_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  if (normalizedPortal) {
    query = query.eq('portal_key', normalizedPortal);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingTableError(error, HISTORY_TABLE_NAME)) {
      return { items: [] };
    }
    throw error;
  }

  return {
    items: Array.isArray(data) ? data : [],
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

  const existingSetting = await getPublicThemeSetting(normalizedPortal);
  const previousPresetKey = existingSetting?.preset_key || 'default';
  const changedAt = new Date().toISOString();

  const payload = {
    portal_key: normalizedPortal,
    preset_key: normalizedPreset,
    updated_by_user_id: actor.userId || actor.user_id || null,
    updated_at: changedAt,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(payload, { onConflict: 'portal_key' })
    .select('portal_key, preset_key, updated_at, updated_by_user_id')
    .single();

  if (error) {
    if (isMissingTableError(error, TABLE_NAME)) {
      throw createHttpError(
        500,
        'Theme settings table is missing. Please run the portal theme settings migration first.'
      );
    }
    throw error;
  }

  await insertThemeHistoryEntry({
    portalKey: normalizedPortal,
    previousPresetKey,
    nextPresetKey: normalizedPreset,
    actor,
    changedAt,
  });

  return data;
}

module.exports = {
  PORTAL_KEYS,
  PRESET_KEYS,
  getPublicThemeSetting,
  getThemeSettings,
  getThemeHistory,
  updateThemeSetting,
};
