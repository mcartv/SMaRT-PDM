const { resolveInternalRealtimeSecret } = require('../utils/internalRealtimeSecret');

const RELAY_TIMEOUT_MS = 15000;
const RELAY_RETRY_DELAY_MS = 300;

function cleanBaseUrl(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function getStudentBackendBaseUrl() {
  return cleanBaseUrl(
    process.env.STUDENT_BACKEND_BASE_URL ||
      process.env.MOBILE_BACKEND_URL ||
      process.env.MOBILE_API_URL ||
      process.env.STUDENT_API_BASE_URL ||
      ''
  );
}

function getInternalRealtimeSecret() {
  const explicit = String(process.env.INTERNAL_REALTIME_SECRET || '').trim();
  return explicit || resolveInternalRealtimeSecret();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postRealtime(path, body, label = 'event') {
  const baseUrl = getStudentBackendBaseUrl();
  const secret = getInternalRealtimeSecret();

  if (!baseUrl || !secret) {
    console.warn(
      `[Student Realtime Relay] skipped ${label}: missing student backend URL or shared realtime authentication. Shared Supabase realtime remains available where the source table is published.`
    );

    return {
      success: false,
      skipped: true,
      reason: !baseUrl ? 'missing_student_backend_url' : 'missing_realtime_authentication',
    };
  }

  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-realtime-secret': secret,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        return {
          success: true,
          data,
          attempt,
        };
      }

      lastError = new Error(`HTTP ${response.status}`);
      console.error('[Student Realtime Relay] request failed:', {
        label,
        attempt,
        status: response.status,
        data,
      });

      // Authentication/validation failures are deterministic; retrying them
      // only creates duplicate noise. Retry transient server failures only.
      if (response.status < 500 || attempt >= 2) {
        return {
          success: false,
          status: response.status,
          data,
          attempt,
        };
      }
    } catch (error) {
      lastError = error;
      console.error('[Student Realtime Relay] request error:', {
        label,
        attempt,
        error: error?.name === 'AbortError' ? 'timeout' : error?.message,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < 2) {
      await wait(RELAY_RETRY_DELAY_MS);
    }
  }

  return {
    success: false,
    error:
      lastError?.name === 'AbortError'
        ? 'Student realtime relay timed out.'
        : lastError?.message || 'Student realtime relay failed.',
  };
}

async function relayMessageEvent({
  event,
  payload = {},
  targetUserIds = [],
}) {
  return postRealtime(
    '/api/internal/realtime/message-event',
    {
      event,
      payload,
      targetUserIds,
    },
    `message event ${event || 'unknown'}`
  );
}

async function relayRoEvent({
  event = 'ro:updated',
  payload = {},
  targetUserIds = [],
}) {
  return postRealtime(
    '/api/internal/realtime/ro-event',
    {
      event,
      payload,
      targetUserIds,
    },
    `RO event ${event}`
  );
}

async function relayRenewalEvent({
  event = 'renewal:updated',
  payload = {},
}) {
  return postRealtime(
    '/api/internal/realtime/renewal-event',
    {
      event,
      payload,
    },
    `renewal event ${event}`
  );
}

async function relayModuleEvent({
  event,
  payload = {},
  targetUserIds = [],
}) {
  return postRealtime(
    '/api/internal/realtime/module-event',
    {
      event,
      payload,
      targetUserIds,
    },
    `module event ${event || 'unknown'}`
  );
}

module.exports = {
  getStudentBackendBaseUrl,
  relayMessageEvent,
  relayRoEvent,
  relayRenewalEvent,
  relayModuleEvent,
};
