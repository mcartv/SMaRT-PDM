'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { read } = require('./_current-system-test-utils');

function loadService(file, pool = {}, now = '2026-10-10T12:00:00Z') {
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
  }
  const context = vm.createContext({
    Date: FixedDate, exports: {}, module: { exports: {} }, console, process: { env: {} },
    require: (name) => name === '../config/db' ? pool : {},
  });
  context.module.exports = context.exports;
  vm.runInContext(read(file), context);
  return context;
}

test('payout time preserves midnight, noon and late evening and rejects invalid input', () => {
  const { validatePayoutTime } = loadService('backend/services/payoutService.js');
  for (const value of ['00:00', '12:00', '23:59', '09:30']) {
    assert.equal(validatePayoutTime(value), value);
  }
  for (const value of ['', null, '24:00', '12:60', '9:30', '09:30 AM']) {
    assert.throws(() => validatePayoutTime(value), { statusCode: 400 });
  }
});

test('creating a payout persists its local time without changing the scheduled date', async () => {
  const opening = { opening_id: 'opening-1', program_id: 'program-1', amount_per_scholar: 1000 };
  const client = {
    release() {},
    async query(sql, params) {
      if (/INSERT INTO payout_batches/.test(sql)) {
        return { rows: [{ payout_batch_id: 'batch-1', payout_date: params[5], payout_time: params[11], payout_venue: params[12] }] };
      }
      return { rows: [] };
    },
  };
  const pool = {
    connect: async () => client,
    async query(sql) {
      if (/FROM program_openings po/.test(sql)) return { rows: [opening] };
      if (/SELECT st.student_id/.test(sql)) return { rows: [{ student_id: 'student-1' }] };
      return { rows: [] };
    },
  };
  const service = loadService('backend/services/payoutService.js', pool).module.exports;
  const batch = await service.createPayoutBatchFromOpening({ opening_id: 'opening-1',
    payout_title: 'Test payout', payout_date: '2099-06-01', payout_time: '00:15',
    payment_mode: 'Cash', scholar_ids: ['student-1'] });
  assert.equal(batch.payout_date, '2099-06-01');
  assert.equal(batch.payout_time, '00:15');
  assert.equal(batch.payout_venue, 'OSFA - Office of Scholarship and Financial Assistance');
  const custom = await service.createPayoutBatchFromOpening({ opening_id: 'opening-1',
    payout_title: 'Custom venue payout', payout_date: '2099-06-01', payout_time: '12:00',
    payout_venue: '  OSFA Annex  ', payment_mode: 'Cash', scholar_ids: ['student-1'] });
  assert.equal(custom.payout_venue, 'OSFA Annex');
});

test('payout venue rejects blank and excessively long values before saving', async () => {
  const service = loadService('backend/services/payoutService.js').module.exports;
  for (const payout_venue of ['', '   ', 'a'.repeat(251)]) {
    await assert.rejects(service.createPayoutBatchFromOpening({ opening_id: 'opening', payout_title: 'Payout',
      payout_date: '2099-06-01', payout_time: '12:00', payment_mode: 'Cash', payout_venue }), { statusCode: 400 });
  }
});

test('coordinator venue updates persist the trimmed venue and retain the previous value for audit', async () => {
  const calls = [];
  const service = loadService('backend/services/payoutService.js', {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [{ payout_batch_id: params[0], payout_venue: params[1], previous_payout_venue: 'OSFA' }] };
    },
  }).module.exports;
  const row = await service.updatePayoutVenue('batch-1', '  Main Auditorium  ');
  assert.equal(row.payout_venue, 'Main Auditorium');
  assert.equal(row.previous_payout_venue, 'OSFA');
  assert.deepEqual(Array.from(calls[0].params), ['batch-1', 'Main Auditorium']);
  assert.match(calls[0].sql, /COALESCE\(is_archived, FALSE\) = FALSE/);
  assert.match(calls[0].sql, /FOR UPDATE/);
  assert.match(calls[0].sql, /updated_at = now\(\)/);
});

test('venue editing rejects blank venues, missing batches, and archived batches', async () => {
  const missing = loadService('backend/services/payoutService.js', { query: async () => ({ rows: [] }) }).module.exports;
  await assert.rejects(missing.updatePayoutVenue('missing', 'Auditorium'), { statusCode: 404 });
  const archived = loadService('backend/services/payoutService.js', { query: async (sql) => ({
    rows: sql.startsWith('SELECT is_archived') ? [{ is_archived: true }] : [],
  }) }).module.exports;
  await assert.rejects(archived.updatePayoutVenue('archived', 'Auditorium'), { statusCode: 409 });
  await assert.rejects(archived.updatePayoutVenue('batch', ' '), { statusCode: 400 });
});

test('academic dates accept leap days and reject impossible dates, partial ranges and year mismatches', () => {
  const { validateAcademicDates } = loadService('backend/services/academicYearService.js');
  assert.equal(validateAcademicDates('2028-02-29', '2029-05-31', 2028, 2029).startDate, '2028-02-29');
  assert.throws(() => validateAcademicDates(null, null, 2026, 2027), { statusCode: 400 });
  for (const [start, end] of [
    ['2026-02-29', '2027-05-31'], ['2026-06-01', '2027-04-31'],
    ['2025-06-01', '2027-05-31'], ['2026-06-01', null],
    [null, '2027-05-31'], ['06/01/2026', '2027-05-31'],
  ]) {
    assert.throws(() => validateAcademicDates(start, end, 2026, 2027), { statusCode: 400 });
  }
});

test('academic dates reject past days using the Manila date at the UTC midnight boundary', () => {
  const { validateAcademicDates } = loadService('backend/services/academicYearService.js', {}, '2026-10-09T16:00:00Z');
  assert.throws(() => validateAcademicDates('2026-10-09', '2027-05-31', 2026, 2027), { statusCode: 400 });
  assert.equal(validateAcademicDates('2026-10-10', '2027-05-31', 2026, 2027).startDate, '2026-10-10');
  assert.equal(validateAcademicDates('2026-10-11', '2027-05-31', 2026, 2027).startDate, '2026-10-11');
});

test('academic-year creation derives years from dates and rejects past dates before accessing the database', async () => {
  const service = loadService('backend/services/academicYearService.js').exports;
  await assert.rejects(() => service.createAcademicYear({ start_date: '2026-10-09', end_date: '2027-05-31' }), { statusCode: 400 });
});

test('academic-year create and edit persist dates and retain them when omitted during edits', async () => {
  let stored;
  const client = {
    release() {},
    async query(sql, params) {
      if (/INSERT INTO academic_years/.test(sql)) {
        stored = { academic_year_id: 'year-1', start_year: params[0], end_year: params[1],
          is_active: params[2], start_date: params[3], end_date: params[4] };
        return { rows: [stored] };
      }
      if (/FROM academic_years[\s\S]*FOR UPDATE/.test(sql)) return { rows: [stored] };
      if (/UPDATE academic_years[\s\S]*start_year =/.test(sql)) {
        stored = { ...stored, start_year: params[0], end_year: params[1],
          is_active: params[2], start_date: params[4], end_date: params[5] };
        return { rows: [stored] };
      }
      return { rows: [], rowCount: 0 };
    },
  };
  const service = loadService('backend/services/academicYearService.js', { connect: async () => client }).exports;
  const created = await service.createAcademicYear({ start_date: '2026-10-15', end_date: '2027-05-30' });
  assert.equal(created.start_year, 2026);
  assert.equal(created.end_year, 2027);
  assert.equal(created.start_date, '2026-10-15');
  assert.equal(created.end_date, '2027-05-30');
  const updated = await service.updateAcademicYear('year-1', { end_date: '2027-06-01' });
  assert.equal(updated.start_date, '2026-10-15');
  assert.equal(updated.end_date, '2027-06-01');
  const retained = await service.updateAcademicYear('year-1', { is_active: false });
  assert.equal(retained.end_date, '2027-06-01');
});
