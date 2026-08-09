const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATION_KEY = '20260809000100_canonical_iot_ocr_candidates';
const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260809000100_canonical_iot_ocr_candidates.sql'
);

function migrationConnectionString() {
  const dedicated = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (dedicated) return dedicated;
  const fallback = String(process.env.DATABASE_URL || '').trim();
  if (!fallback) throw new Error('MIGRATION_DATABASE_URL/DATABASE_URL is required.');
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      'IOT_OCR_MIGRATION_CONNECTION=DATABASE_URL_FALLBACK; ' +
      'set MIGRATION_DATABASE_URL to separate DDL and runtime privileges.'
    );
  }
  return fallback;
}

function migrationBody(sql) {
  return String(sql || '')
    .replace(/^\s*begin\s*;\s*/i, '')
    .replace(/\s*commit\s*;\s*$/i, '')
    .trim();
}

function createPool() {
  return new Pool({
    connectionString: migrationConnectionString(),
    max: 1,
    ssl: process.env.DATABASE_SSL_DISABLED === 'true'
      ? false
      : { rejectUnauthorized: false },
  });
}

async function verifySchema(client) {
  const objects = await client.query(`
    SELECT
      to_regclass('public.iot_ocr_requests') IS NOT NULL AS has_requests,
      to_regclass('public.iot_ocr_candidates') IS NOT NULL AS has_candidates,
      to_regclass('public.iot_ocr_reviews') IS NOT NULL AS has_reviews,
      EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'iot_ocr_candidates'
          AND t.tgname = 'trg_iot_ocr_candidates_immutable'
          AND NOT t.tgisinternal
      ) AS has_immutability_trigger
  `);
  const row = objects.rows[0] || {};
  if (!row.has_requests || !row.has_candidates || !row.has_reviews || !row.has_immutability_trigger) {
    throw new Error(`Canonical OCR schema verification failed: ${JSON.stringify(row)}`);
  }

  const constraints = await client.query(`
    SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.iot_ocr_requests'::regclass AND contype = 'c'
  `);
  const definitions = constraints.rows.map(({ definition }) => String(definition || '')).join('\n');
  const required = [
    'pending', 'claimed', 'previewing', 'focusing', 'capturing', 'processing',
    'review_required', 'completed', 'cancelled', 'failed', 'expired',
  ];
  const missing = required.filter((status) => !definitions.includes(status));
  if (missing.length) throw new Error(`Missing canonical OCR statuses: ${missing.join(', ')}`);
}

async function ensureRuntimeRolePermissions(client) {
  const role = await client.query(`
    SELECT rolname, rolsuper FROM pg_roles
    WHERE rolname = 'smart_pdm_runtime' LIMIT 1
  `);
  if (!role.rowCount) {
    console.warn('IOT_OCR_RUNTIME_ROLE=ABSENT');
    return;
  }
  if (role.rows[0].rolsuper) throw new Error('smart_pdm_runtime must not be a superuser.');

  const owner = await client.query(`
    SELECT pg_get_userbyid(c.relowner) AS owner_name
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'iot_ocr_candidates'
      AND c.relkind IN ('r', 'p') LIMIT 1
  `);
  if (owner.rows[0]?.owner_name === 'smart_pdm_runtime') {
    throw new Error('smart_pdm_runtime must not own public.iot_ocr_candidates.');
  }
  await client.query('GRANT SELECT, INSERT ON public.iot_ocr_candidates TO smart_pdm_runtime');
  await client.query('REVOKE UPDATE, DELETE, TRUNCATE ON public.iot_ocr_candidates FROM smart_pdm_runtime');
}

async function ensureCanonicalIotOcrMigration() {
  if (!fs.existsSync(MIGRATION_PATH)) {
    throw new Error(`Canonical migration file missing: ${MIGRATION_PATH}`);
  }
  const sql = migrationBody(fs.readFileSync(MIGRATION_PATH, 'utf8'));
  if (!sql) throw new Error('Canonical OCR migration file is empty.');

  const pool = createPool();
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [MIGRATION_KEY]);
    locked = true;
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.smart_pdm_runtime_migrations (
        migration_key text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    const existing = await client.query(
      'SELECT 1 FROM public.smart_pdm_runtime_migrations WHERE migration_key = $1',
      [MIGRATION_KEY]
    );
    if (!existing.rowCount) {
      await client.query(sql);
      await client.query(
        'INSERT INTO public.smart_pdm_runtime_migrations (migration_key) VALUES ($1)',
        [MIGRATION_KEY]
      );
      console.log(`IOT_OCR_LIVE_MIGRATION_APPLIED=${MIGRATION_KEY}`);
    } else {
      console.log(`IOT_OCR_LIVE_MIGRATION_ALREADY_APPLIED=${MIGRATION_KEY}`);
    }
    await ensureRuntimeRolePermissions(client);
    await verifySchema(client);
    await client.query('COMMIT');
    console.log('IOT_OCR_LIVE_MIGRATION=PASSED');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('IOT_OCR_LIVE_MIGRATION=FAILED', { message: error.message });
    throw error;
  } finally {
    if (locked) {
      try { await client.query('SELECT pg_advisory_unlock(hashtext($1))', [MIGRATION_KEY]); } catch {}
    }
    client.release();
    await pool.end();
  }
}

module.exports = {
  ensureCanonicalIotOcrMigration,
  migrationConnectionString,
  migrationBody,
  MIGRATION_KEY,
  MIGRATION_PATH,
};
