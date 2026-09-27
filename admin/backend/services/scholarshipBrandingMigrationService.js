const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const {
  migrationConnectionString,
  migrationBody,
} = require('./liveMigrationService');

const MIGRATION_KEY = '20260927000400_add_scholarship_branding';
const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260927000400_add_scholarship_branding.sql'
);

async function ensureScholarshipBrandingMigration() {
  if (!fs.existsSync(MIGRATION_PATH)) {
    throw new Error(`Scholarship branding migration file missing: ${MIGRATION_PATH}`);
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
      'smart_pdm_scholarship_branding_migration',
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
      if (!sql) throw new Error('Scholarship branding migration is empty.');
      await client.query(sql);
      await client.query(
        'INSERT INTO public.smart_pdm_runtime_migrations (migration_key) VALUES ($1)',
        [MIGRATION_KEY]
      );
      console.log(`SCHOLARSHIP_BRANDING_MIGRATION_APPLIED=${MIGRATION_KEY}`);
    } else {
      console.log(`SCHOLARSHIP_BRANDING_MIGRATION_ALREADY_APPLIED=${MIGRATION_KEY}`);
    }

    const verification = await client.query(`
      SELECT
        (
          SELECT COUNT(*) = 4
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'benefactors'
            AND column_name IN (
              'admin_logo_url', 'admin_logo_path',
              'landing_image_url', 'landing_image_path'
            )
        ) AS has_benefactor_branding,
        (
          SELECT COUNT(*) = 4
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'scholarship_program'
            AND column_name IN (
              'admin_logo_url', 'admin_logo_path',
              'landing_image_url', 'landing_image_path'
            )
        ) AS has_program_branding
    `);

    const row = verification.rows[0] || {};
    if (!row.has_benefactor_branding || !row.has_program_branding) {
      throw new Error('Scholarship branding migration verification failed.');
    }

    await client.query('COMMIT');
    console.log('SCHOLARSHIP_BRANDING_MIGRATION=PASSED');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('SCHOLARSHIP_BRANDING_MIGRATION=FAILED', { message: error.message });
    throw error;
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [
          'smart_pdm_scholarship_branding_migration',
        ]);
      } catch {}
    }
    client.release();
    await pool.end();
  }
}

module.exports = {
  ensureScholarshipBrandingMigration,
  MIGRATION_KEY,
  MIGRATION_PATH,
};
