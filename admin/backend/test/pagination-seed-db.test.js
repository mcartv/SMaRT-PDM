const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Opt-in: runs the actual manual scripts in one transaction, always rolled back.
// No database changes are committed, including triggers and notification settings.
test('manual pagination seed and cleanup preserve existing records and support reseeding',
  { skip: process.env.PAGINATION_SEED_DB_TESTS !== 'true', timeout: 240000 }, async () => {
    require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
    const folder = path.resolve(__dirname, '../../../supabase/test-data');
    const sql = (name) => fs.readFileSync(path.join(folder, name), 'utf8')
      .replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '');
    const seed = sql('pagination-seed.sql');
    const cleanup = sql('pagination-cleanup.sql');
    const tables = ['users', 'students', 'applications', 'endorsement_slips', 'renewals',
      'payout_batches', 'payout_batch_students', 'announcements', 'profile_photo_reviews',
      'scholarship_program', 'program_openings', 'academic_course', 'academic_years',
      'academic_period', 'notifications'];
    async function snapshot() {
      const result = {};
      for (const table of tables) {
        result[table] = (await client.query(`SELECT count(*)::int AS n FROM public.${table}`)).rows[0].n;
      }
      result.settings = (await client.query('SELECT * FROM public.general_settings ORDER BY general_settings_id')).rows;
      result.periods = (await client.query('SELECT period_id, is_active FROM public.academic_period ORDER BY period_id')).rows;
      return result;
    }
    async function verifySeed() {
      const rows = (await client.query(`SELECT
        (SELECT count(*)::int FROM students WHERE student_id::text LIKE 'e6d2e778-%') AS students,
        (SELECT count(*)::int FROM students WHERE student_id::text LIKE 'e6d2e778-%' AND NOT scholar_is_archived AND scholarship_status <> 'None') AS scholars,
        (SELECT count(*)::int FROM students WHERE student_id::text LIKE 'e6d2e778-%' AND scholar_is_archived) AS removed,
        (SELECT count(*)::int FROM applications WHERE opening_id = 'e6d2e778-0006-4000-8000-000000000002') AS applicants,
        (SELECT count(*)::int FROM applications WHERE opening_id = 'e6d2e778-0006-4000-8000-000000000002' AND queue_position IS NOT NULL) AS fcfs,
        (SELECT count(*)::int FROM renewals r JOIN academic_period ap USING(period_id)
          JOIN applications a USING(application_id) JOIN program_openings po ON po.opening_id = a.opening_id
          WHERE r.renewal_id::text LIKE 'e6d2e778-%' AND ap.is_active AND r.period_id <> po.period_id) AS renewals,
        (SELECT count(*)::int FROM payout_batches WHERE payout_batch_id::text LIKE 'e6d2e778-%') AS batches,
        (SELECT count(*)::int FROM announcements WHERE announcement_id::text LIKE 'e6d2e778-%') AS announcements,
        (SELECT count(*)::int FROM profile_photo_reviews pr JOIN students st USING(student_id)
          WHERE pr.review_id::text LIKE 'e6d2e778-%' AND pr.user_id = st.user_id AND NOT st.is_archived) AS photos`)).rows[0];
      assert.deepEqual(rows, { students: 204, scholars: 45, removed: 15, applicants: 144,
        fcfs: 24, renewals: 45, batches: 30, announcements: 90, photos: 90 });
      const stages = (await client.query(`SELECT current_stage, count(*)::int AS n FROM endorsement_slips
        WHERE opening_id = 'e6d2e778-0006-4000-8000-000000000002' GROUP BY current_stage`)).rows;
      assert.equal(stages.find(r => r.current_stage === 'pending_pd').n, 24);
      assert.equal(stages.find(r => r.current_stage === 'pending_guidance').n, 24);
      assert.equal(stages.find(r => r.current_stage === 'pending_sdo').n, 24);
      const page = (await client.query(`SELECT pdm_id FROM students
        WHERE student_id::text LIKE 'e6d2e778-%' AND NOT scholar_is_archived AND scholarship_status <> 'None'
        ORDER BY pdm_id LIMIT 10 OFFSET 40`)).rows;
      assert.equal(page.length, 5);
      assert.equal(page[0].pdm_id, 'PGTEST-0041');
    }
    try {
      await client.connect();
      await client.query('BEGIN');
      const original = await snapshot();
      assert.equal((await client.query("SELECT count(*)::int AS n FROM students WHERE student_id::text LIKE 'e6d2e778-%'")).rows[0].n, 0,
        'Clean up previously committed fixtures before running rollback verification.');
      await client.query(seed);
      await verifySeed();
      assert.deepEqual((await snapshot()).settings, original.settings);
      assert.equal((await snapshot()).notifications, original.notifications);
      await client.query('SAVEPOINT duplicate_seed');
      await assert.rejects(client.query(seed), /already exists/);
      await client.query('ROLLBACK TO SAVEPOINT duplicate_seed');
      await client.query(cleanup);
      assert.deepEqual(await snapshot(), original);
      await client.query(cleanup);
      assert.deepEqual(await snapshot(), original);

      // Also exercise reuse of an existing active period if the DB had none.
      if (!original.periods.some(row => row.is_active)) {
        await client.query(`INSERT INTO academic_years(academic_year_id,start_year,end_year)
          SELECT 'e6d2e779-0008-4000-8000-000000000001', y, y+1
          FROM (SELECT greatest(coalesce(max(start_year),2026)+100,2200) AS y FROM academic_years) t`);
        await client.query(`INSERT INTO academic_period(period_id,academic_year_id,term,is_active)
          VALUES ('e6d2e779-0009-4000-8000-000000000001','e6d2e779-0008-4000-8000-000000000001','First Semester',true)`);
      }
      const beforeReuse = await snapshot();
      await client.query(seed);
      await verifySeed();
      assert.deepEqual((await snapshot()).periods.filter(r => !r.period_id.startsWith('e6d2e778')), beforeReuse.periods);
      await client.query(cleanup);
      assert.deepEqual(await snapshot(), beforeReuse);
    } finally {
      if (client._connected) await client.query('ROLLBACK');
      await client.end();
    }
  });
