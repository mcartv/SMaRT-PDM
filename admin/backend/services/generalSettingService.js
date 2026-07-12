const supabase = require('../config/supabase');

const TABLE_NAME = 'general_settings';

const DEFAULT_GENERAL_SETTINGS = {
  general_settings_id: 1,
  institution_name: 'Pambayang Dalubhasaan ng Marilao',
  office_name: 'Office for Scholarship and Financial Assistance',
  office_email: 'osfa@pdm.edu.ph',
  office_address: 'Abangan Norte, Marilao, Bulacan',
  landline_number: '(044) 919-8191',
  office_hours: 'Monday - Friday, 8:00 AM - 5:00 PM',
  global_deadline: '2026-03-31',
  applications_open: true,
  updated_at: null,
  updated_by_user_id: null,
  is_fallback: true,
};

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function safeText(value, maxLength = 255) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  return normalized.slice(0, maxLength);
}

function normalizeDate(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
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

function sanitizeSettings(payload = {}) {
  return {
    institution_name:
      safeText(payload.institution_name, 180) || DEFAULT_GENERAL_SETTINGS.institution_name,
    office_name:
      safeText(payload.office_name, 180) || DEFAULT_GENERAL_SETTINGS.office_name,
    office_email:
      safeText(payload.office_email, 180) || DEFAULT_GENERAL_SETTINGS.office_email,
    office_address:
      safeText(payload.office_address, 220) || DEFAULT_GENERAL_SETTINGS.office_address,
    landline_number:
      safeText(payload.landline_number, 80) || DEFAULT_GENERAL_SETTINGS.landline_number,
    office_hours:
      safeText(payload.office_hours, 120) || DEFAULT_GENERAL_SETTINGS.office_hours,
    global_deadline:
      normalizeDate(payload.global_deadline) || DEFAULT_GENERAL_SETTINGS.global_deadline,
    applications_open:
      typeof payload.applications_open === 'boolean'
        ? payload.applications_open
        : DEFAULT_GENERAL_SETTINGS.applications_open,
  };
}

function buildFallbackSettings() {
  return { ...DEFAULT_GENERAL_SETTINGS };
}

function canManage(actor = {}) {
  return String(actor.role || '').trim().toLowerCase() === 'admin';
}

async function getGeneralSettings() {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(
      'general_settings_id, institution_name, office_name, office_email, office_address, landline_number, office_hours, global_deadline, applications_open, updated_at, updated_by_user_id'
    )
    .eq('general_settings_id', 1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, TABLE_NAME)) {
      return buildFallbackSettings();
    }
    throw error;
  }

  return data || buildFallbackSettings();
}

async function getPublicGeneralSettings() {
  return getGeneralSettings();
}

async function updateGeneralSettings(payload = {}, actor = {}) {
  if (!canManage(actor)) {
    throw createHttpError(403, 'Access denied for general settings.');
  }

  const sanitized = sanitizeSettings(payload);

  const upsertPayload = {
    general_settings_id: 1,
    ...sanitized,
    updated_at: new Date().toISOString(),
    updated_by_user_id: actor.userId || actor.user_id || null,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(upsertPayload, { onConflict: 'general_settings_id' })
    .select(
      'general_settings_id, institution_name, office_name, office_email, office_address, landline_number, office_hours, global_deadline, applications_open, updated_at, updated_by_user_id'
    )
    .single();

  if (error) {
    if (isMissingTableError(error, TABLE_NAME)) {
      throw createHttpError(
        500,
        'General settings table is missing. Please run the general settings migration first.'
      );
    }
    throw error;
  }

  return data;
}

module.exports = {
  DEFAULT_GENERAL_SETTINGS,
  getGeneralSettings,
  getPublicGeneralSettings,
  updateGeneralSettings,
};
