const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const {
  migrationConnectionString,
  migrationBody,
} = require('./liveMigrationService');

const MIGRATION_KEY = '20260825000100_system_maintenance_controls';
const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260825000100_system_maintenance_controls.sql'
);

async function ensureSystemMaintenanceMigration() {
  if (!fs.existsSync(MIGRATION_PATH)) {
    throw new Error(`System maintenance migration file missing: ${MIGRATION_PATH}`);
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
      'smart_pdm_system_maintenance_migration',
    ]);
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
      const sql = migrationBody(fs.readFileSync(MIGRATION_PATH, 'utf8'));
      if (!sql) throw new Error('System maintenance migration is empty.');
      await client.query(sql);
      await client.query(
        'INSERT INTO public.smart_pdm_runtime_migrations (migration_key) VALUES ($1)',
        [MIGRATION_KEY]
      );
      console.log(`SYSTEM_MAINTENANCE_MIGRATION_APPLIED=${MIGRATION_KEY}`);
    } else {
      console.log(`SYSTEM_MAINTENANCE_MIGRATION_ALREADY_APPLIED=${MIGRATION_KEY}`);
    }

    const verification = await client.query(`
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'general_settings'
            AND column_name = 'maintenance_mode'
        ) AS has_maintenance_mode,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'general_settings'
            AND column_name = 'maintenance_message'
        ) AS has_maintenance_message
    `);

    const row = verification.rows[0] || {};
    if (!row.has_maintenance_mode || !row.has_maintenance_message) {
      throw new Error('System maintenance migration verification failed.');
    }

    await client.query('COMMIT');
    console.log('SYSTEM_MAINTENANCE_MIGRATION=PASSED');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('SYSTEM_MAINTENANCE_MIGRATION=FAILED', { message: error.message });
    throw error;
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [
          'smart_pdm_system_maintenance_migration',
        ]);
      } catch {}
    }
    client.release();
    await pool.end();
  }
}

module.exports = {
  ensureSystemMaintenanceMigration,
  MIGRATION_KEY,
  MIGRATION_PATH,
};
