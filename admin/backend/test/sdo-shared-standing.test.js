const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('scholar profile reads disciplinary columns from the SDO schema and returns the incident date', async () => {
  const schema = fs.readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20260722_create_sdo_student_records.sql'), 'utf8');
  const tableBody = schema.match(/CREATE TABLE[^]+?\(([^]+?)\n\);/)[1];
  const columns = new Set([...tableBody.matchAll(/^\s+(\w+)\s+\w+/gm)].map(match => match[1]));
  const context = { exports: {}, require: name => {
    if (name === '../config/db') return { query: async (sql, params) => {
      if (!sql.includes('AS sdo_incident_date')) return { rows: [] };
      for (const [, column] of sql.matchAll(/\brecord\.(\w+)/g)) {
        assert.ok(columns.has(column), `SDO column ${column} must exist in the database schema`);
      }
      assert.equal(params[0], 'student-1');
      return { rows: [{ student_id: 'student-1', sdo_status: 'Major Offense', sdo_comment: 'Reviewed by SDO', sdo_incident_date: '2026-10-10' }] };
    } };
    if (name === '../config/supabase' || name === '../utils/listPagination') return {};
    throw new Error('Unexpected dependency: ' + name);
  } };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../services/scholarService.js'), 'utf8'), context);
  const profile = await context.exports.fetchScholarById('student-1');
  assert.equal(profile.sdo_incident_date, '2026-10-10');
  assert.equal(profile.sdo_comment, 'Reviewed by SDO');
  assert.equal(profile.sdu_level, 'major');
});

test('scholar list filters, counts, and display use the active SDO standing as their source', async () => {
  let pageOptions;
  const context = { exports: {}, require: name => {
    if (name === '../config/db' || name === '../config/supabase') return {};
    if (name === '../utils/listPagination') return {
      paginationRequested: () => true, listFilters: () => ({ where: 'true', params: [] }),
      queryPage: async (_db, options) => { pageOptions = options; return { items: [{ student_id: 'student-1', sdo_status: 'Major Offense', sdo_comment: 'Recorded by SDO' }] }; },
    };
    throw new Error('Unexpected dependency: ' + name);
  } };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../services/scholarService.js'), 'utf8'), context);
  const page = await context.exports.fetchAllScholars({ limit: 20, view: 'sdo', probation: 'major' });
  assert.match(pageOptions.source, /FROM public\.sdo_student_records AS record/);
  assert.match(pageOptions.source, /record\.is_archived = false/);
  assert.match(pageOptions.source, /upper\(btrim\(record\.student_number\)\) = upper\(btrim\(st\.pdm_id\)\)/);
  assert.match(pageOptions.source, /record\.updated_at DESC, record\.record_id DESC LIMIT 1/);
  assert.match(pageOptions.source, /st\.sdo_status, 'Clear'\) AS sdo_status/);
  assert.match(pageOptions.summary.major, /sdo_status = 'Major Offense'/);
  assert.equal(page.items[0].sdu_level, 'major');
  assert.equal(page.items[0].sdo_comment, 'Recorded by SDO');
});

test('scholar standing endpoint delegates to the same disciplinary writer and preserves its response contract', async () => {
  let update;
  const context = { exports: {}, require: name => {
    if (name === '../config/db' || name === '../config/supabase') return {};
    if (name === '../utils/listPagination') return {};
    if (name === './studentRegistryService') return { updateScholarDisciplinaryStanding: async args => {
      update = args;
      return { student_id: args.studentId, first_name: 'Test', last_name: 'Student', sdo_status: 'Major Offense' };
    } };
    throw new Error('Unexpected dependency: ' + name);
  } };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../services/scholarService.js'), 'utf8'), context);
  const result = await context.exports.updateScholarSdoStatus('student-1', { status: 'major', comment: 'Reviewed' }, { user_id: 'staff-1' });
  assert.deepEqual(JSON.parse(JSON.stringify(update)), { studentId: 'student-1', status: 'major', comment: 'Reviewed', actorId: 'staff-1' });
  assert.equal(result.scholar_id, 'student-1');
  assert.equal(result.sdu_level, 'major');
  assert.equal(result.sdo_status, 'Major Offense');
});
