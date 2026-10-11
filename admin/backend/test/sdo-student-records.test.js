const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('SDO file selection rejects unsupported, empty, and oversized files and safely exports issues', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/utils/sdoImportFile.js'), 'utf8');
  const context = { module: { exports: {} } };
  vm.runInNewContext(source.replace(/export /g, '') + '\nmodule.exports = { validateSdoImportFile, buildImportIssuesCsv };', context);
  const { validateSdoImportFile, buildImportIssuesCsv } = context.module.exports;
  assert.equal(validateSdoImportFile({ name: 'records.XLSX', size: 15 * 1024 * 1024 }), '');
  assert.match(validateSdoImportFile({ name: 'records.xls', size: 100 }), /XLSX/);
  assert.match(validateSdoImportFile({ name: 'records.csv', size: 0 }), /empty/);
  assert.match(validateSdoImportFile({ name: 'records.csv', size: 15 * 1024 * 1024 + 1 }), /15 MB/);
  const csv = buildImportIssuesCsv([{ row_number: 2, student_number: '=SUM(1)', status: 'duplicate', reason: 'Duplicate, "ID"' }, { row_number: 3, status: 'ready' }]);
  assert.match(csv, /'=SUM\(1\)/);
  assert.match(csv, /"Duplicate, ""ID"""/);
  assert.doesNotMatch(csv, /ready/);
});

test('import preview searches and filters before paginating without changing the import rows', () => {
  const context = { module: { exports: {} } };
  const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/utils/sdoImportPreview.js'), 'utf8');
  vm.runInNewContext(source.replace(/export /g, '') + '\nmodule.exports = { getImportPreviewPage };', context);
  const { getImportPreviewPage } = context.module.exports;
  const rows = Array.from({ length: 45 }, (_, index) => ({
    student_number: `PDM-2023-${String(index).padStart(6, '0')}`,
    first_name: 'Maria', last_name: 'Cruz', status: index < 40 ? 'ready' : 'invalid',
    offense_type: 'Major Offense', course_code: index % 2 ? 'BSIT' : 'BECED',
  }));
  const second = getImportPreviewPage(rows, { page: 1 });
  assert.equal(second.rows.length, 20);
  assert.equal(second.rows[0], rows[20]);
  assert.equal(second.totalPages, 3);
  assert.equal(getImportPreviewPage(rows, { page: 2 }).rows.length, 5);
  const filtered = getImportPreviewPage(rows, { search: 'Maria Cruz', status: 'invalid', offense: 'Major Offense', page: 2 });
  assert.equal(filtered.total, 5);
  assert.equal(filtered.page, 0);
  assert.equal(getImportPreviewPage(rows, { search: '000044' }).total, 1);
  const coursePage = getImportPreviewPage(rows, { course: 'bsit', page: 1 });
  assert.equal(coursePage.total, 22);
  assert.equal(coursePage.rows.length, 2);
  assert.ok(coursePage.rows.every(row => row.course_code === 'BSIT'));
  assert.equal(getImportPreviewPage(rows, { course: 'BECED', status: 'invalid' }).total, 3);
  const empty = getImportPreviewPage(rows, { offense: 'No Offense', page: 7 });
  assert.equal(empty.total, 0);
  assert.equal(empty.page, 0);
  assert.equal(empty.totalPages, 1);
  assert.equal(rows.length, 45);
});

test('combined student navigation accepts either permission and denies accounts with neither', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/utils/rbacNavigationPolicy.js'), 'utf8');
  const context = { module: { exports: {} } };
  vm.runInNewContext(source.replace(/export /g, '') + '\nmodule.exports = { canSeePath };', context);
  const { canSeePath } = context.module.exports;
  for (const permission of ['students.view', 'discipline.manage']) {
    assert.equal(canSeePath('/sdo/students', 'ready', code => code === permission), true);
  }
  assert.equal(canSeePath('/sdo/students', 'ready', () => false), false);
  assert.equal(canSeePath('/sdo/students', 'loading', () => true), false);
  assert.equal(canSeePath('/admin/scholars', 'ready', code => code === 'discipline.manage'), false);
});

test('disciplinary search, offense, and course filters run before counting and pagination', async () => {
  const calls = [];
  const supabase = { from(table) {
    const query = {};
    for (const method of ['select', 'eq', 'in', 'or', 'order', 'range']) {
      query[method] = (...args) => { calls.push({ table, method, args }); return query; };
    }
    query.then = (resolve, reject) => Promise.resolve({
      data: table === 'student_master_records' ? [{ student_number: 'PDM-2023-000001' }]
        : table === 'academic_course' ? [{ course_id: 'course-1', course_code: 'BSIT', course_name: 'Information Technology' }] : [],
      count: 0, error: null,
    }).then(resolve, reject);
    return query;
  } };
  const context = { module: { exports: {} }, Buffer, console, require: name => {
    if (name === '../config/supabase') return supabase;
    if (name === '../config/db' || name === './studentRegistryIdentity') return {};
    return require(name);
  } };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../services/studentRegistryService.js'), 'utf8'), context);
  const result = await context.module.exports.listSdoStudentRegistry({ search: 'Maria Cruz', offense: 'Major Offense', course: 'bsit', limit: 20, offset: 20 });
  assert.equal(result.total, 0);
  const recordCalls = calls.filter(call => call.table === 'sdo_student_records');
  const filter = recordCalls.findIndex(call => call.method === 'in');
  const search = recordCalls.findIndex(call => call.method === 'or');
  const page = recordCalls.findIndex(call => call.method === 'range');
  assert.ok(filter >= 0 && filter < page);
  assert.ok(search >= 0 && search < page);
  assert.ok(recordCalls[filter].args[1].includes('Major Offense'));
  assert.match(recordCalls[search].args[0], /PDM-2023-000001/);
  const course = recordCalls.findIndex(call => call.method === 'or' && call.args[0].includes('course_code.eq.'));
  assert.ok(course >= 0 && course < page);
  assert.match(recordCalls[course].args[0], /course_code.eq."BSIT"/);
  assert.match(recordCalls[course].args[0], /and\(or\(course_code.is.null,course_code.eq.""\),student_number.in.\(PDM-2023-000001\)\)/);
  assert.ok(calls.some(call => call.table === 'student_master_records' && call.method === 'eq' && call.args[0] === 'course_id' && call.args[1] === 'course-1'));
  assert.equal(result.course_options[0].course_code, 'BSIT');
  assert.deepEqual(recordCalls[page].args, [20, 39]);
  assert.equal(calls.filter(call => call.table === 'student_master_records' && call.method === 'or').length, 2);
  await assert.rejects(context.module.exports.listSdoStudentRegistry({ offense: 'unknown' }), error => error.statusCode === 400);
  await assert.rejects(context.module.exports.listSdoStudentRegistry({ course: 'unknown' }), error => error.statusCode === 400);
});
