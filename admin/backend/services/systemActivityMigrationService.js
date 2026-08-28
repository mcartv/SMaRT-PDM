const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const {
  migrationConnectionString,
  migrationBody,
} = require('./liveMigrationService');

const MIGRATION_KEY = '20260827232500_system_activity_metrics';
const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260827232500_system_activity_metrics.sql'
);

const MIGRATIONS = Object.freeze([
  {
    key: MIGRATION_KEY,
    path: MIGRATION_PATH,
  },
  {
    key: '20260828163000_system_activity_daily_visitors',
    path: path.resolve(
      __dirname,
      '../../../supabase/migrations/20260828163000_system_activity_daily_visitors.sql'
    ),
  },
]);

async function ensureSystemActivityMigration() {
  for (const migration of MIGRATIONS) {
    if (!fs.existsSync(migration.path)) {
      throw new Error(`System activity migration file missing: ${migration.path}`);
    }
  }

  const pool = new Pool({
    connectionString: migrationConnectionString(),
    max: 1,
    ssl: process.env.DATABASE_SSL_DISABLED === 'true'
      ? false
      : { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  let locked = false;

  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [
      'smart_pdm_system_activity_migration',
    ]);
    locked = true;
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.smart_pdm_runtime_migrations (
        migration_key text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    for (const migration of MIGRATIONS) {
      const existing = await client.query(
        'SELECT 1 FROM public.smart_pdm_runtime_migrations WHERE migration_key = $1',
        [migration.key]
      );

      if (existing.rowCount) continue;

      const sql = migrationBody(fs.readFileSync(migration.path, 'utf8'));
      if (!sql) throw new Error(`System activity migration is empty: ${migration.key}`);
      await client.query(sql);
      await client.query(
        'INSERT INTO public.smart_pdm_runtime_migrations (migration_key) VALUES ($1)',
        [migration.key]
      );
      console.log(`SYSTEM_ACTIVITY_MIGRATION_APPLIED=${migration.key}`);
    }

    const verification = await client.query(`
      SELECT
        to_regclass('public.system_activity_hourly') IS NOT NULL AS has_hourly,
        to_regclass('public.system_active_sessions') IS NOT NULL AS has_sessions,
        to_regclass('public.public_web_visitors') IS NOT NULL AS has_visitors,
        to_regclass('public.public_web_visitor_daily') IS NOT NULL AS has_daily_visitors
    `);

    const row = verification.rows[0] || {};
    if (
      !row.has_hourly ||
      !row.has_sessions ||
      !row.has_visitors ||
      !row.has_daily_visitors
    ) {
      throw new Error('System activity migration verification failed.');
    }

    await client.query('COMMIT');
    console.log('SYSTEM_ACTIVITY_MIGRATION=PASSED');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('SYSTEM_ACTIVITY_MIGRATION=FAILED', { message: error.message });
    throw error;
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [
          'smart_pdm_system_activity_migration',
        ]);
      } catch {}
    }
    client.release();
    await pool.end();
  }
}

module.exports = {
  ensureSystemActivityMigration,
  MIGRATION_KEY,
  MIGRATION_PATH,
  MIGRATIONS,
};
