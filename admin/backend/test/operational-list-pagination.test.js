const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePagination, listFilters, queryPage } = require('../utils/listPagination');
const { loadListService } = require('./_operational-pagination-test-utils');

test('pagination validates positive integers and caps page size', () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 10 });
  assert.equal(parsePagination({ limit: '999' }).limit, 100);
  for (const value of ['-1', '0', '1.5', 'abc', 'Infinity']) {
    assert.throws(() => parsePagination({ page: value }), { statusCode: 400 });
    assert.throws(() => parsePagination({ limit: value }), { statusCode: 400 });
  }
});

test('search is bound literally and normalized student-number search stays database-side', () => {
  const value = "x' OR true --%_";
  const filters = listFilters({ search: value, program: 'TES' }, { program: 'program_name', studentNumber: 'pdm_id' }, ['student_name'], ['actor']);
  assert.ok(!filters.where.includes(value));
  assert.match(filters.where, /regexp_replace/);
  assert.deepEqual(filters.params.slice(0, 3), ['actor', 'TES', value.toLowerCase()]);
});

test('filtered total clamps invalid pages before issuing LIMIT/OFFSET', async () => {
  const calls = [];
  const result = await queryPage({ query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: calls.length === 1 ? [{ filtered_total: '23', programs: ['TES'], pending: '17' }] : [{ id: 21 }] };
  } }, { source: 'SELECT id, status, program_name FROM queue', query: { page: 999, limit: 10 }, where: 'status = $1', params: ['pending'],
    order: 'id ASC', facets: { programs: 'program_name' }, summary: { pending: "count(*) FILTER (WHERE status = 'pending')" } });
  assert.equal(result.pagination.page, 3);
  assert.equal(result.pagination.total, 23);
  assert.equal(result.pagination.hasPrevious, true);
  assert.equal(result.pagination.hasNext, false);
  assert.match(calls[0].sql, /count\(\*\) FILTER \(WHERE status = \$1\) AS filtered_total/);
  assert.match(calls[1].sql, /WHERE status = \$1 ORDER BY id ASC LIMIT \$2 OFFSET \$3/);
  assert.deepEqual(calls[1].params, ['pending', 10, 20]);
  assert.equal(result.summary.pending, 17);
});

test('empty pages have valid navigation metadata', async () => {
  const result = await queryPage({ query: async (sql) => ({ rows: /AS filtered_total/.test(sql) ? [{ filtered_total: 0 }] : [] }) },
    { source: 'SELECT id FROM queue', query: { page: 5 }, order: 'id ASC' });
  assert.deepEqual(result.items, []);
  assert.deepEqual(result.pagination, { page: 1, limit: 10, total: 0, totalPages: 1, hasPrevious: false, hasNext: false });
});

for (const [name, method, args] of [
  ['scholarService', 'fetchAllScholars', [{ page: 2, limit: 10, search: 'PDM-25', program: 'TES' }]],
  ['scholarService', 'fetchRemovedScholars', [{ page: 2, limit: 10, search: 'PDM-25' }]],
  ['renewalService', 'fetchRenewals', [{ page: 2, limit: 10 }]],
  ['payoutService', 'fetchPayoutBatches', [{ page: 2, limit: 6 }]],
  ['programOpeningService', 'fetchApplicationsByOpeningId', ['opening', { page: 2, limit: 10, view: 'current' }]],
  ['endorsementSlipService', 'fetchAllSlips', [{ role: 'admin' }, { page: 2, limit: 10, tab: 'active' }]],
  ['announcementService', 'fetchAnnouncements', [{ page: 2, limit: 10, search: 'TES' }]],
  ['announcementService', 'fetchArchivedAnnouncements', [{ page: 2, limit: 10 }]],
  ['adminProfilePhotoService', 'getProfilePhotoReviews', [{ adminUserId: 'admin', query: { page: 2, limit: 10 } }]],
]) {
  test(`${name}.${method} queries only the requested database page`, async () => {
    const harness = loadListService(name);
    const result = await harness.service[method](...args);
    assert.equal(result.pagination.total, 25);
    const page = harness.calls.find(({ sql }) => /LIMIT \$\d+ OFFSET \$\d+/.test(sql));
    assert.ok(page);
    const size = name === 'payoutService' ? 6 : 10;
    assert.deepEqual(page.params.slice(-2), [size, size]);
    assert.match(page.sql, /WHERE[\s\S]*ORDER BY[\s\S]*LIMIT/);
    assert.ok(!page.sql.includes('.slice('));
  });
}

for (const role of ['sdo', 'guidance', 'pd']) {
  test(`${role} endorsement queue applies authorization before count and pagination`, async () => {
    const harness = loadListService('endorsementSlipService');
    await harness.service.fetchQueue(role, { role, user_id: 'actor' }, { page: 1, status: 'pending', search: 'student' });
    const count = harness.calls[0];
    assert.match(count.sql, /verification_status/);
    if (role === 'pd') {
      assert.match(count.sql, /program_director_course_assignments/);
      assert.equal(count.params[0], 'actor');
    } else {
      assert.match(count.sql, new RegExp(`es\\.${role}_status IS NOT NULL`));
    }
    assert.match(count.sql, /count\(\*\) FILTER \(WHERE/);
    const denied = loadListService('endorsementSlipService');
    await assert.rejects(denied.service.fetchQueue(role, { role: 'applicant' }, { page: 1 }), { statusCode: 403 });
    assert.equal(denied.calls.length, 0);
  });
}

test('renewals constrain enrichment to page IDs after current-period and eligibility filtering', async () => {
  const harness = loadListService('renewalService', {
    items: [{ renewal_id: 'r-page', student_id: 's-page', program_id: 'p-page', period_id: 'period-page' }],
    tableRows: { renewals: [{ renewal_id: 'r-page', student_id: 's-page', program_id: 'p-page', period_id: 'period-page' }] },
  });
  await harness.service.fetchRenewals({ page: 1 });
  assert.match(harness.calls[0].sql, /ap\.is_active = true/);
  assert.match(harness.calls[0].sql, /r\.period_id <> po\.period_id/);
  const renewalRead = harness.reads.find(({ table }) => table === 'renewals');
  assert.deepEqual(Array.from(renewalRead.filters.find(([method]) => method === 'in')[2]), ['r-page']);
  const documentRead = harness.reads.find(({ table }) => table === 'renewal_documents');
  assert.deepEqual(Array.from(documentRead.filters.find(([method]) => method === 'in')[2]), ['r-page']);
  const studentRead = harness.reads.find(({ table }) => table === 'students');
  assert.deepEqual(Array.from(studentRead.filters.find(([method]) => method === 'in')[2]), ['s-page']);
});

test('payout aggregation and avatar hydration run only after selecting batch IDs', async () => {
  const harness = loadListService('payoutService', { items: [{ payout_batch_id: 'batch-page' }] });
  await harness.service.fetchPayoutBatches({ page: 1, limit: 6, tab: 'completed' });
  assert.ok(!harness.calls[0].sql.includes('json_agg'));
  const aggregate = harness.calls.find(({ sql }) => sql.includes('json_agg'));
  assert.match(aggregate.sql, /WHERE pb\.payout_batch_id = ANY\(\$1\)/);
  assert.deepEqual(Array.from(aggregate.params[0]), ['batch-page']);
});

test('opening applications deduplicate and rank FCFS globally before pagination', async () => {
  const harness = loadListService('programOpeningService');
  await harness.service.fetchApplicationsByOpeningId('opening', { page: 2, view: 'approved' });
  const sql = harness.calls[1].sql;
  assert.match(sql, /PARTITION BY a\.student_id, a\.opening_id/);
  assert.match(sql, /a\.application_id = st\.current_application_id/);
  assert.match(sql, /FROM canonical WHERE canonical_rank = 1/);
  assert.match(sql, /AS fcfs_rank/);
  assert.match(sql, /queue_position END ASC NULLS LAST,[\s\S]*fcfs_completed_at ASC NULLS LAST, submission_date ASC NULLS LAST, application_id ASC/);
  assert.match(sql, /AND \(approved\)/);
  assert.match(harness.calls[2].sql, /WHERE NOT approved[\s\S]*LIMIT 1/);
});

test('opening details calculate counters without loading every application', async () => {
  const harness = loadListService('programOpeningService', {
    tableRows: { program_openings: [{ opening_id: 'opening', allocated_slots: 10 }] },
    extraRows: [{ application_count: 20, pending_count: 3, qualified_count: 10 }],
  });
  await harness.service.fetchProgramOpeningById('opening');
  assert.match(harness.calls[0].sql, /count\(\*\) AS application_count/);
  assert.deepEqual(Array.from(harness.calls[0].params), ['opening']);
  assert.ok(!harness.reads.some(({ table }) => table === 'applications'));
});

test('profile counts preserve student ownership and visibility and are global aggregates', async () => {
  const harness = loadListService('adminProfilePhotoService', { summary: { pending: 41, approved: 72, rejected: 6, superseded: 20 } });
  const result = await harness.service.getProfilePhotoReviews({ adminUserId: 'admin', query: { page: 1, status: 'pending' } });
  assert.equal(result.status_counts.pending, 41);
  assert.equal(result.status_counts.approved, 72);
  assert.match(harness.calls[0].sql, /st\.user_id = r\.user_id/);
  assert.match(harness.calls[0].sql, /coalesce\(st\.is_archived, false\) = false/);
  assert.match(harness.calls[0].sql, /count\(\*\) FILTER \(WHERE status = 'approved'\)/);
  assert.ok(!harness.reads.some(({ table }) => table === 'profile_photo_reviews'));
});

test('announcement archive and active scopes stay distinct with deterministic ordering', async () => {
  for (const [method, archived, order] of [['fetchAnnouncements', 'false', 'created_at'], ['fetchArchivedAnnouncements', 'true', 'updated_at']]) {
    const harness = loadListService('announcementService');
    await harness.service[method]({ page: 1, status: archived === 'true' ? 'Archived' : 'Published' });
    assert.match(harness.calls[0].sql, new RegExp(`a\\.is_archived = ${archived}`));
    assert.match(harness.calls[1].sql, new RegExp(`ORDER BY ${order} DESC, announcement_id ASC LIMIT`));
  }
});
