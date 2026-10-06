// SMaRT-PDM: Applications — application Availability Service (mobile backend service); contains mobile-facing business logic and data operations.
const MANILA_TIME_ZONE = 'Asia/Manila';
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// createAvailabilityError: creates create availability error for the Applications flow.
function createAvailabilityError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

// normalizeDateOnly: normalizes normalize date only for the Applications flow.
function normalizeDateOnly(value) {
  if (value == null || String(value).trim() === '') return null;

  const normalized = String(value).trim();
  if (!DATE_ONLY_PATTERN.test(normalized)) return null;

  const [year, month, day] = normalized.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return normalized;
}

// getManilaDateKey: reads and returns get manila date key for the Applications flow.
function getManilaDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const value = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );

  return `${value.year}-${value.month}-${value.day}`;
}

// loadApplicationAvailabilityPolicy: loads and returns load application availability policy for the Applications flow.
async function loadApplicationAvailabilityPolicy({ now = new Date() } = {}) {
  const supabase = require('../config/supabase');
  const [settingsResult, periodResult] = await Promise.all([
    supabase
      .from('general_settings')
      .select('applications_open, global_deadline')
      .eq('general_settings_id', 1)
      .maybeSingle(),
    supabase
      .from('academic_period')
      .select('period_id, academic_year_id, term')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
  ]);

  if (settingsResult.error) throw settingsResult.error;
  if (periodResult.error) throw periodResult.error;

  const settings = settingsResult.data || {};
  const configuredDeadline = settings.global_deadline;
  const deadline = normalizeDateOnly(configuredDeadline);

  if (configuredDeadline != null && String(configuredDeadline).trim() !== '' && !deadline) {
    throw createAvailabilityError(
      503,
      'APPLICATION_SETTINGS_INVALID',
      'Application deadline configuration is invalid.'
    );
  }

  const today = getManilaDateKey(now);
  let code = null;
  let message = '';

  if (settings.applications_open === false) {
    code = 'APPLICATIONS_CLOSED';
    message = 'Scholarship applications are currently closed.';
  } else if (deadline && today > deadline) {
    code = 'APPLICATION_DEADLINE_PASSED';
    message = 'The scholarship application deadline has passed.';
  }

  return {
    can_apply: !code,
    code,
    message,
    deadline,
    timezone: MANILA_TIME_ZONE,
    today,
    activePeriod: periodResult.data || null,
  };
}

// assertGlobalApplicationAvailability: handles assert global application availability for the Applications flow.
function assertGlobalApplicationAvailability(policy) {
  if (policy?.can_apply !== false) return;

  throw createAvailabilityError(
    409,
    policy.code || 'APPLICATIONS_CLOSED',
    policy.message || 'Scholarship applications are currently unavailable.'
  );
}

// assertOpeningInActivePeriod: handles assert opening in active period for the Applications flow.
function assertOpeningInActivePeriod(opening, policy) {
  if (!policy?.activePeriod?.period_id) {
    throw createAvailabilityError(
      409,
      'ACADEMIC_PERIOD_UNAVAILABLE',
      'No current academic semester is active. Applications are temporarily unavailable.'
    );
  }

  if (String(opening?.period_id || '') !== String(policy.activePeriod.period_id)) {
    throw createAvailabilityError(
      400,
      'OPENING_OUTSIDE_ACTIVE_PERIOD',
      'This scholarship opening belongs to a previous academic period.'
    );
  }
}

module.exports = {
  MANILA_TIME_ZONE,
  normalizeDateOnly,
  getManilaDateKey,
  loadApplicationAvailabilityPolicy,
  assertGlobalApplicationAvailability,
  assertOpeningInActivePeriod,
};
