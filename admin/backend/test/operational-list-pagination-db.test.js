const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { queryPage } = require('../utils/listPagination');
const { loadListService } = require('./_operational-pagination-test-utils');

const enabled = process.env.PAGINATION_DB_TESTS === 'true';

async function readOnlyDatabase(work) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  try {
    await client.connect();
    await client.query('SET default_transaction_read_only = on');
    await client.query("SET statement_timeout = '15s'");
    await work(client);
  } finally { await client.end(); }
}

test('PostgreSQL filters before LIMIT, counts all matches and clamps to the last page', { skip: !enabled }, async () => {
  await readOnlyDatabase(async (db) => {
    const result = await queryPage(db, {
      source: "SELECT id, CASE WHEN id % 2 = 0 THEN 'pending' ELSE 'approved' END AS status FROM generate_series(1, 45) id",
      query: { page: 99, limit: 10 }, where: 'status = $1', params: ['pending'], order: 'id ASC',
      facets: { statuses: 'status' }, summary: { total: 'count(*)' },
    });
    assert.equal(result.pagination.total, 22);
    assert.equal(result.pagination.page, 3);
    assert.deepEqual(result.items.map((row) => row.id), [42, 44]);
    assert.equal(result.summary.total, 45);
    assert.deepEqual(result.filters.statuses, ['approved', 'pending']);
  });
});

test('actual opening SQL preserves canonical applications, FCFS ranks and next applicant across pages', { skip: !enabled }, async () => {
  const harness = loadListService('programOpeningService');
  await harness.service.fetchApplicationsByOpeningId('opening', { page: 1, limit: 2, view: 'current' });
  // CTE fixtures shadow the real tables. These tests perform SELECTs only.
  const fixtures = `WITH applications(application_id, student_id, opening_id, application_status, selection_status,
      is_archived, submission_date, created_at, queue_position, fcfs_completed_at) AS (
    VALUES
      ('a10', 's1', 'opening', 'pending', 'Unranked', false, '2026-01-01'::timestamptz, '2026-01-01'::timestamptz, 2, '2026-01-01'::timestamptz),
      ('a11', 's1', 'opening', 'pending', 'Unranked', false, '2026-02-01'::timestamptz, '2026-02-01'::timestamptz, 9, '2026-02-01'::timestamptz),
      ('a20', 's2', 'opening', 'approved', 'Selected', false, '2026-01-01'::timestamptz, '2026-01-01'::timestamptz, 1, '2026-01-01'::timestamptz),
      ('a30', 's3', 'opening', 'pending', 'Unranked', false, '2026-01-02'::timestamptz, '2026-01-02'::timestamptz, NULL::int, '2026-01-02'::timestamptz),
      ('a40', 's4', 'opening', 'pending', 'Unranked', false, '2026-01-01'::timestamptz, '2026-01-01'::timestamptz, 3, '2026-01-01'::timestamptz),
      ('a50', 's5', 'opening', 'pending', 'Unranked', false, '2026-01-01'::timestamptz, '2026-01-01'::timestamptz, 8, '2026-01-01'::timestamptz),
      ('a51', 's5', 'opening', 'pending', 'Unranked', false, '2026-02-01'::timestamptz, '2026-02-01'::timestamptz, 4, '2026-02-01'::timestamptz)
  ), students(student_id, first_name, middle_name, last_name, pdm_id, is_archived, current_application_id) AS (
    VALUES ('s1','Test',NULL,'One','PDM1',false,'a10'), ('s2','Test',NULL,'Two','PDM2',false,'a20'),
      ('s3','Test',NULL,'Three','PDM3',false,'a30'), ('s4','Test',NULL,'Four','PDM4',true,'a40'),
      ('s5','Test',NULL,'Five','PDM5',false,NULL)
  )`;
  const withFixtures = (sql) => /^WITH /.test(sql) ? fixtures + ', ' + sql.replace(/^WITH /, '') : fixtures + ' ' + sql;
  await readOnlyDatabase(async (db) => {
    const count = await db.query(withFixtures(harness.calls[0].sql), harness.calls[0].params);
    assert.equal(Number(count.rows[0].filtered_total), 3);
    assert.equal(Number(count.rows[0].approved), 1);
    assert.equal(Number(count.rows[0].fcfs), 4);
    const page = harness.calls[1];
    const first = await db.query(withFixtures(page.sql), page.params);
    assert.deepEqual(first.rows.map((row) => row.application_id), ['a10', 'a51']);
    assert.deepEqual(first.rows.map((row) => Number(row.fcfs_rank)), [2, 3]);
    const second = await db.query(withFixtures(page.sql), [...page.params.slice(0, -2), 2, 2]);
    assert.deepEqual(second.rows.map((row) => row.application_id), ['a30']);
    assert.equal(Number(second.rows[0].fcfs_rank), 4);
    const next = await db.query(withFixtures(harness.calls[2].sql), harness.calls[2].params);
    assert.equal(next.rows[0].id, 'a10');
  });
});
