const crypto = require('crypto');
const pool = require('../config/db');

const ACTIVE_WINDOW_MINUTES = 10;
const SESSION_PERSIST_INTERVAL_MS = 60 * 1000;
const REQUEST_FLUSH_INTERVAL_MS = 15 * 1000;
const requestBuckets = new Map();
const sessionPersistedAt = new Map();
let flushPromise = null;
let flushTimer = null;

const PUBLIC_WEB_PATH_PREFIXES = Object.freeze([
  '/landing',
  '/about',
  '/how-to-apply',
  '/privacy',
  '/terms',
  '/login',
  '/admin/login',
  '/admin/forgot-password',
  '/endorsement/verify',
]);

function hourBucket(date = new Date()) {
  const bucket = new Date(date);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket.toISOString();
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase().slice(0, 60) || 'unknown';
}

function resolveUserId(user = {}) {
  return String(user.user_id || user.userId || user.sub || '').trim();
}

function shouldCountApiRequest(req) {
  const path = String(req?.originalUrl || req?.url || '');
  return !path.includes('/api/system-maintenance/activity/heartbeat');
}

function incrementRequestBucket() {
  const bucket = hourBucket();
  requestBuckets.set(bucket, Number(requestBuckets.get(bucket) || 0) + 1);
}

async function persistSessionActivity({ sessionKey, userId, role }) {
  await pool.query(
    `
      INSERT INTO public.system_active_sessions (
        session_key,
        user_id,
        role,
        first_seen_at,
        last_seen_at
      )
      VALUES ($1, $2::uuid, $3, NOW(), NOW())
      ON CONFLICT (session_key)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        role = EXCLUDED.role,
        last_seen_at = NOW()
    `,
    [sessionKey, userId, role]
  );
}

function recordAuthenticatedRequest({ req, user, rawToken }) {
  const userId = resolveUserId(user);
  const token = String(rawToken || '').trim();
  if (!userId || !token) return;

  if (shouldCountApiRequest(req)) incrementRequestBucket();

  const sessionKey = sha256(token);
  const now = Date.now();
  const lastPersisted = Number(sessionPersistedAt.get(sessionKey) || 0);

  if (now - lastPersisted >= SESSION_PERSIST_INTERVAL_MS) {
    sessionPersistedAt.set(sessionKey, now);
    void persistSessionActivity({
      sessionKey,
      userId,
      role: normalizeRole(user?.role),
    }).catch((error) => {
      sessionPersistedAt.delete(sessionKey);
      console.error('SYSTEM ACTIVITY SESSION WRITE ERROR:', error.message);
    });
  }
}

async function flushRequestMetrics() {
  if (flushPromise) return flushPromise;
  if (!requestBuckets.size) return;

  const snapshot = Array.from(requestBuckets.entries());
  for (const [bucket] of snapshot) requestBuckets.delete(bucket);

  flushPromise = (async () => {
    try {
      for (const [bucket, count] of snapshot) {
        await pool.query(
          `
            INSERT INTO public.system_activity_hourly (
              bucket_hour,
              authenticated_requests,
              updated_at
            )
            VALUES ($1::timestamptz, $2::bigint, NOW())
            ON CONFLICT (bucket_hour)
            DO UPDATE SET
              authenticated_requests = public.system_activity_hourly.authenticated_requests + EXCLUDED.authenticated_requests,
              updated_at = NOW()
          `,
          [bucket, count]
        );
      }
    } catch (error) {
      for (const [bucket, count] of snapshot) {
        requestBuckets.set(bucket, Number(requestBuckets.get(bucket) || 0) + Number(count || 0));
      }
      throw error;
    } finally {
      flushPromise = null;
    }
  })();

  return flushPromise;
}

function startMetricsFlushTimer() {
  if (flushTimer) return flushTimer;
  flushTimer = setInterval(() => {
    void flushRequestMetrics().catch((error) => {
      console.error('SYSTEM ACTIVITY REQUEST FLUSH ERROR:', error.message);
    });
  }, REQUEST_FLUSH_INTERVAL_MS);
  if (typeof flushTimer.unref === 'function') flushTimer.unref();
  return flushTimer;
}

function normalizeVisitorId(value) {
  const visitorId = String(value || '').trim();
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(visitorId)) {
    const error = new Error('Invalid visitor identifier.');
    error.statusCode = 400;
    throw error;
  }
  return visitorId;
}

function normalizePublicPath(value) {
  const path = String(value || '').trim();
  const allowed = path.length <= 180 && PUBLIC_WEB_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );

  if (!allowed) {
    const error = new Error('Invalid public web path.');
    error.statusCode = 400;
    throw error;
  }

  return path;
}

async function recordPublicVisit({ visitorId, path }) {
  const cleanVisitorId = normalizeVisitorId(visitorId);
  const visitorHash = sha256(cleanVisitorId);
  const cleanPath = normalizePublicPath(path);

  await pool.query(
    `
      WITH recorded_visitor AS (
        INSERT INTO public.public_web_visitors (
          visitor_hash,
          first_seen_at,
          last_seen_at,
          visit_count,
          last_path
        )
        VALUES ($1, NOW(), NOW(), 1, $2)
        ON CONFLICT (visitor_hash)
        DO UPDATE SET
          last_seen_at = NOW(),
          visit_count = public.public_web_visitors.visit_count + 1,
          last_path = EXCLUDED.last_path
        RETURNING visitor_hash
      )
      INSERT INTO public.public_web_visitor_days (
        visitor_hash,
        visit_date,
        first_seen_at,
        last_seen_at,
        visit_count
      )
      SELECT
        visitor_hash,
        (NOW() AT TIME ZONE 'Asia/Manila')::date,
        NOW(),
        NOW(),
        1
      FROM recorded_visitor
      ON CONFLICT (visitor_hash, visit_date)
      DO UPDATE SET
        last_seen_at = NOW(),
        visit_count = public.public_web_visitor_days.visit_count + 1
    `,
    [visitorHash, cleanPath]
  );
}

async function getPublicVisitorCounts() {
  const result = await pool.query(`
    SELECT
      COUNT(DISTINCT visitor_hash) FILTER (
        WHERE visit_date = (NOW() AT TIME ZONE 'Asia/Manila')::date
      )::integer AS today,
      COUNT(DISTINCT visitor_hash) FILTER (
        WHERE visit_date = (NOW() AT TIME ZONE 'Asia/Manila')::date - 1
      )::integer AS yesterday,
      COUNT(DISTINCT visitor_hash) FILTER (
        WHERE visit_date >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Manila')::date
          AND visit_date <= (NOW() AT TIME ZONE 'Asia/Manila')::date
      )::integer AS this_month
    FROM public.public_web_visitor_days
    WHERE visit_date >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Manila')::date - 1
  `);
  const counts = result.rows[0] || {};

  return {
    today: Number(counts.today || 0),
    yesterday: Number(counts.yesterday || 0),
    this_month: Number(counts.this_month || 0),
    timezone: 'Asia/Manila',
    measured_at: new Date().toISOString(),
  };
}

async function cleanupOldActivity() {
  await Promise.all([
    pool.query(`DELETE FROM public.system_activity_hourly WHERE bucket_hour < NOW() - INTERVAL '8 days'`),
    pool.query(`DELETE FROM public.system_active_sessions WHERE last_seen_at < NOW() - INTERVAL '7 days'`),
    pool.query(`DELETE FROM public.public_web_visitors WHERE last_seen_at < NOW() - INTERVAL '30 days'`),
    pool.query(`DELETE FROM public.public_web_visitor_days WHERE visit_date < (NOW() AT TIME ZONE 'Asia/Manila')::date - 93`),
  ]);
}

async function getActivitySummary() {
  await flushRequestMetrics();

  const [requestsResult, sessionsResult, visitorsResult] = await Promise.all([
    pool.query(`
      SELECT COALESCE(SUM(authenticated_requests), 0)::bigint AS count
      FROM public.system_activity_hourly
      WHERE bucket_hour >= date_trunc('hour', NOW() - INTERVAL '23 hours')
    `),
    pool.query(
      `
        SELECT COUNT(*)::integer AS count
        FROM public.system_active_sessions
        WHERE last_seen_at >= NOW() - ($1 * INTERVAL '1 minute')
      `,
      [ACTIVE_WINDOW_MINUTES]
    ),
    pool.query(`
      SELECT COUNT(*)::integer AS count
      FROM public.public_web_visitors
      WHERE last_seen_at >= NOW() - INTERVAL '24 hours'
    `),
  ]);

  void cleanupOldActivity().catch((error) => {
    console.error('SYSTEM ACTIVITY CLEANUP ERROR:', error.message);
  });

  return {
    api_requests_24h: Number(requestsResult.rows[0]?.count || 0),
    active_sessions: Number(sessionsResult.rows[0]?.count || 0),
    web_visitors_24h: Number(visitorsResult.rows[0]?.count || 0),
    active_window_minutes: ACTIVE_WINDOW_MINUTES,
    measured_at: new Date().toISOString(),
  };
}

module.exports = {
  ACTIVE_WINDOW_MINUTES,
  PUBLIC_WEB_PATH_PREFIXES,
  flushRequestMetrics,
  getActivitySummary,
  getPublicVisitorCounts,
  normalizePublicPath,
  normalizeVisitorId,
  recordAuthenticatedRequest,
  recordPublicVisit,
  startMetricsFlushTimer,
};
