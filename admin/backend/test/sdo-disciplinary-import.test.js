const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness({ studentCount = 9, failUpdate = false, failLinkedUpdate = false, failInsertBatch = 0 } = {}) {
  const saved = [];
  const updates = [];
  const linkedUpdates = [];
  const writes = [];
  let insertBatches = 0;
  let transactionSnapshot;
  const client = {
    async query(sql, params) {
      writes.push(sql);
      if (sql === 'BEGIN') transactionSnapshot = { saved: saved.map(row => ({ ...row })), updates: updates.length, linkedUpdates: linkedUpdates.length };
      if (sql === 'ROLLBACK') {
        saved.splice(0, saved.length, ...transactionSnapshot.saved);
        updates.splice(transactionSnapshot.updates);
        linkedUpdates.splice(transactionSnapshot.linkedUpdates);
      }
      if (sql.includes('INSERT INTO public.sdo_student_records')) {
        insertBatches += 1;
        if (insertBatches === failInsertBatch) throw Object.assign(new Error('Duplicate ID'), { code: '23505' });
        const batch = JSON.parse(params[0]);
        const rows = batch.map(row => {
          const existing = saved.find(record => record.student_number === row.student_number);
          const record = existing || { record_id: String(saved.length + 1) };
          Object.assign(record, row);
          if (!existing) saved.push(record);
          return { ...record, was_added: !existing };
        });
        return { rows };
      }
      if (sql.includes('UPDATE public.sdo_student_records')) {
        const incoming = JSON.parse(params[0])[0];
        const existing = saved.find(row => row.record_id === params[1]);
        if (!existing) return { rows: [] };
        Object.assign(existing, incoming);
        return { rows: [{ ...existing, was_added: false }] };
      }
      if (sql.includes('UPDATE public.student_master_records')) {
        if (failUpdate) throw new Error('Master update failed');
        updates.push(...JSON.parse(params[0]).map(row => ({ ...row, has_disciplinary_action: row.offense_type !== 'No Offense' })));
      }
      if (sql.includes('UPDATE public.students')) {
        if (failLinkedUpdate) throw new Error('Linked student update failed');
        linkedUpdates.push(...JSON.parse(params[0]).map(row => ({ student_number: row.student_number, sdo_status: row.offense_type === 'No Offense' ? 'Clear' : row.offense_type })));
      }
      return { rows: [] };
    },
    release() { writes.push('RELEASE'); },
  };
  const supabase = { from(table) {
    let selected;
    let payload;
    let recordId;
    const query = {
      select(fields) { selected = fields; return this; },
      in() { return this; },
      eq(key, value) {
        if (key === 'record_id') recordId = value;
        if (payload && table === 'student_master_records') {
          updates.push({ student_number: value, ...payload });
          return Promise.resolve({ error: null });
        }
        return this;
      },
      update(value) { payload = value; return this; },
      insert(value) {
        saved.push(...value);
        return this;
      },
      maybeSingle() { return Promise.resolve({ data: saved.find(row => row.record_id === recordId) || null, error: null }); },
      then(resolve, reject) {
        let data = [];
        if (table === 'student_master_records') data = Array.from({ length: studentCount }, (_, index) => ({ student_number: `PDM-2023-${String(index + 1).padStart(6, '0')}`, course_id: 'bsit', year_level: '3' }));
        if (table === 'academic_course') data = [{ course_id: 'bsit', course_code: 'BSIT', course_name: 'Information Technology' }, { course_id: 'bscs', course_code: 'BSCS' }];
        if (table === 'sdo_student_records' && selected.startsWith('record_id')) data = saved;
        if (table === 'sdo_student_records' && selected.startsWith('student_number')) data = saved;
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  } };
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-10-11T04:00:00Z'])); }
  }
  const context = { module: { exports: {} }, Buffer, console, Date: FixedDate, require: name => {
    if (name === '../config/supabase') return supabase;
    if (name === '../config/db') return { connect: async () => client, query: async (sql, params) => ({ rows: params[0] === 'scholar-1' ? [{ student_id: 'scholar-1', pdm_id: 'PDM-2023-000001', first_name: 'Test', last_name: 'Student', ro_status: 'Pending' }] : [] }) };
    if (name === './studentRegistryIdentity') return {};
    return require(name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services/studentRegistryService.js'), 'utf8'), context);
  const service = context.module.exports;
  return { service, saved, updates, linkedUpdates, writes };
}

test('large SDO imports use 200-row batches and commit case and master updates together', async () => {
  const { service, saved, updates, writes } = harness({ studentCount: 405 });
  const file = { originalname: 'large.csv', buffer: Buffer.from(['Student Number,Offense Type', ...Array.from({ length: 405 }, (_, index) => `PDM-2023-${String(index + 1).padStart(6, '0')},Major Offense`)].join('\n')) };
  const result = await service.importSdoDisciplinaryRecordsFile({ file });
  assert.equal(result.imported, 405);
  assert.equal(saved.length, 405);
  assert.equal(updates.length, 405);
  assert.equal(writes.filter(sql => sql.includes('INSERT INTO')).length, 3);
  assert.equal(writes.filter(sql => sql.includes('UPDATE public.student_master_records')).length, 3);
  assert.equal(writes.filter(sql => sql.includes('UPDATE public.students AS')).length, 3);
  assert.equal(writes[0], 'BEGIN');
  assert.deepEqual(writes.slice(-2), ['COMMIT', 'RELEASE']);
});

test('failed master synchronization or concurrent duplicate rolls back every batch', async () => {
  for (const options of [{ failUpdate: true }, { failLinkedUpdate: true }, { failInsertBatch: 2 }]) {
    const { service, saved, updates, writes } = harness({ studentCount: 201, ...options });
    const file = { originalname: 'large.csv', buffer: Buffer.from(['Student Number,Offense Type', ...Array.from({ length: 201 }, (_, index) => `PDM-2023-${String(index + 1).padStart(6, '0')},Major Offense`)].join('\n')) };
    await assert.rejects(service.importSdoDisciplinaryRecordsFile({ file }), options.failUpdate ? /Master update failed/ : options.failLinkedUpdate ? /Linked student update failed/ : error => error.statusCode === 409);
    assert.equal(saved.length, 0);
    assert.equal(updates.length, 0);
    assert.deepEqual(writes.slice(-2), ['ROLLBACK', 'RELEASE']);
  }
});

test('scholar edits, imports, and record edits share one case and synchronized mobile and scholar standing', async () => {
  const { service, saved, updates, linkedUpdates } = harness();
  const scholar = await service.updateScholarDisciplinaryStanding({ studentId: 'scholar-1', status: 'major', comment: 'Reviewed by SDO', actorId: 'staff-1' });
  assert.equal(scholar.sdo_status, 'Major Offense');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].offense_type, 'Major Offense');
  assert.equal(saved[0].remarks, 'Reviewed by SDO');
  assert.equal(updates.at(-1).offense_type, 'Major Offense');
  assert.equal(linkedUpdates.at(-1).sdo_status, 'Major Offense');
  await service.importSdoDisciplinaryRecordsFile({ file: { originalname: 'cases.csv', buffer: Buffer.from('Student Number,Offense Type\nPDM-2023-000001,Minor Offense') } });
  assert.equal(saved.length, 1);
  assert.equal(linkedUpdates.at(-1).sdo_status, 'Minor Offense');
  await service.updateSdoDisciplinaryRecord({ recordId: '1', values: { offense_type: 'No Offense' } });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].offense_type, 'No Offense');
  assert.equal(updates.at(-1).has_disciplinary_action, false);
  assert.equal(linkedUpdates.at(-1).sdo_status, 'Clear');
});

test('scholar standing updates validate classification and never write for a missing scholar', async () => {
  const { service, saved, writes } = harness();
  assert.equal(await service.updateScholarDisciplinaryStanding({ studentId: 'missing', status: 'major', comment: '' }), null);
  await assert.rejects(service.updateScholarDisciplinaryStanding({ studentId: 'scholar-1', status: 'suspension', comment: '' }), /Invalid SDO status/);
  assert.equal(saved.length, 0);
  assert.equal(writes.length, 0);
});

test('SDO import previews invalid/unmatched/duplicate rows and saves only valid cases', async () => {
  const { service, saved, updates } = harness();
  const file = { originalname: 'cases.csv', buffer: Buffer.from([
    'Student Number,Offense Type,Incident Date,Course,Year Level,Remarks',
    'PDM-2023-000001,Minor Offense,2026-10-01,BSCS,2,Test case',
    'PDM-2023-000001,Minor,2026-10-01,BSCS,2,Duplicate case',
    'PDM-2023-000099,Major,2026-10-01,BSIT,3,Unknown student',
    'PDM-2023-000002,,2026-10-01,BSIT,3,Missing offense',
    'PDM-2023-000003,Minor Offense,2026-10-01,BSCS,2,Valid student',
  ].join('\n')) };
  const preview = await service.previewSdoDisciplinaryRecordsFile({ file });
  assert.equal(preview.counts.ready, 1);
  assert.equal(preview.counts.duplicate, 2);
  assert.equal(preview.counts.unmatched, 1);
  assert.equal(preview.counts.invalid, 1);
  assert.equal(saved.length, 0);
  const result = await service.importSdoDisciplinaryRecordsFile({ file, actorId: 'officer-1' });
  assert.equal(result.imported, 1);
  assert.equal(saved[0].offense_type, 'Minor Offense');
  assert.equal(saved[0].recorded_by, 'officer-1');
  assert.equal(saved[0].course_code, 'BSCS');
  assert.equal(saved[0].year_level, '2');
  assert.equal('case_reference_number' in saved[0], false);
  assert.equal(updates[0].has_disciplinary_action, true);
});

test('SDO validates the three classifications and rejects very old, future, and impossible dates', async () => {
  const { service, saved, updates } = harness();
  const file = { originalname: 'cases.csv', buffer: Buffer.from([
    'Student Number,Offense Type,Incident Date',
    'PDM-2023-000001,No Offense,',
    'PDM-2023-000002,Minor Offense,2020-01-01',
    'PDM-2023-000003,Major Offense,2016-10-11',
    'PDM-2023-000004,Major Offense,2014-01-01',
    'PDM-2023-000005,Major Offense,2026-10-12',
    'PDM-2023-000006,Major Offense,02/30/2026',
    'PDM-2023-000007,Suspension,2026-10-01',
  ].join('\n')) };
  const preview = await service.previewSdoDisciplinaryRecordsFile({ file });
  assert.equal(preview.counts.ready, 3);
  assert.equal(preview.counts.invalid, 4);
  assert.match(preview.rows[3].reason, /ten years/);
  assert.match(preview.rows[4].reason, /future/);
  assert.match(preview.rows[5].reason, /invalid/);
  assert.match(preview.rows[6].reason, /No Offense, Minor Offense, or Major Offense/);
  assert.equal(preview.rows[0].course_code, 'BSIT');
  assert.equal(preview.rows[0].year_level, '3');
  await service.importSdoDisciplinaryRecordsFile({ file });
  assert.equal(saved.length, 3);
  assert.equal(updates[0].has_disciplinary_action, false);
  assert.equal(updates[2].has_disciplinary_action, true);
  await service.importSdoDisciplinaryRecordsFile({ file: {
    originalname: 'clear.csv',
    buffer: Buffer.from('Student Number,Offense Type\nPDM-2023-000001,No Offense'),
  } });
  assert.equal(updates.length, 4);
});

test('duplicate IDs with different offenses are all rejected, even when one row is invalid', async () => {
  const { service, saved } = harness();
  const file = { originalname: 'duplicates.csv', buffer: Buffer.from([
    'Student Number,Offense Type', 'pdm-2023-000001,Major Offense', ' PDM-2023-000001 ,invalid',
  ].join('\n')) };
  const preview = await service.previewSdoDisciplinaryRecordsFile({ file });
  assert.equal(preview.counts.ready, 0);
  assert.equal(preview.counts.duplicate, 2);
  await service.importSdoDisciplinaryRecordsFile({ file });
  assert.equal(saved.length, 0);
});

test('missing headers, malformed IDs, unknown courses and invalid year levels are rejected', async () => {
  const { service } = harness();
  await assert.rejects(service.previewSdoDisciplinaryRecordsFile({ file: { originalname: 'bad.csv', buffer: Buffer.from('Student Number,Notes\nPDM-2023-000001,test') } }), /Missing Offense Type column/);
  const file = { originalname: 'bad.csv', buffer: Buffer.from([
    'Student Number,Offense Type,Course,Year Level',
    'INVALID,Minor Offense,BSIT,1',
    'PDM-2023-000002,Minor Offense,UNKNOWN,1',
    'PDM-2023-000003,Minor Offense,BSIT,7',
    ',,BSIT,2',
  ].join('\n')) };
  const preview = await service.previewSdoDisciplinaryRecordsFile({ file });
  assert.equal(preview.counts.invalid, 4);
  assert.match(preview.rows[0].reason, /format/);
  assert.match(preview.rows[1].reason, /Maintenance/);
  assert.match(preview.rows[2].reason, /1 and 6/);
  assert.match(preview.rows[3].reason, /PDM ID is required/);
});

test('existing Student IDs are updated in place, with added and updated counts', async () => {
  const { service, saved, updates } = harness();
  const file = { originalname: 'one.csv', buffer: Buffer.from('Student Number,Offense Type,Incident Date\nPDM-2023-000001,Major Offense,2026-10-01') };
  await service.importSdoDisciplinaryRecordsFile({ file });
  const changed = { originalname: 'two.csv', buffer: Buffer.from('Student Number,Offense Type,Incident Date\nPDM-2023-000001,Minor Offense,2026-10-02') };
  const preview = await service.previewSdoDisciplinaryRecordsFile({ file: changed });
  assert.equal(preview.counts.ready, 1);
  assert.equal(preview.rows[0].operation, 'update');
  const result = await service.importSdoDisciplinaryRecordsFile({ file: changed });
  assert.equal(result.imported, 1);
  assert.equal(result.added, 0);
  assert.equal(result.updated, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].offense_type, 'Minor Offense');
  assert.equal(saved[0].offense_incident_date, '2026-10-02');
  assert.equal(updates.at(-1).offense_type, 'Minor Offense');
});

test('import preserves omitted optional fields while direct edits can clear date and remarks', async () => {
  const { service, saved, updates } = harness();
  await service.importSdoDisciplinaryRecordsFile({ file: { originalname: 'one.csv', buffer: Buffer.from('Student Number,Offense Type,Course,Year Level,Incident Date,Remarks\nPDM-2023-000001,Major Offense,BSCS,2,2026-10-01,Original note') } });
  await service.importSdoDisciplinaryRecordsFile({ file: { originalname: 'two.csv', buffer: Buffer.from('Student Number,Offense Type\nPDM-2023-000001,Minor Offense') } });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].course_code, 'BSCS');
  assert.equal(saved[0].year_level, '2');
  assert.equal(saved[0].remarks, 'Original note');
  assert.equal(saved[0].offense_incident_date, '2026-10-01');
  await service.updateSdoDisciplinaryRecord({ recordId: '1', actorId: 'sdo-user', values: {
    offense_type: 'No Offense', course_code: 'BSIT', year_level: '4', offense_incident_date: '', remarks: '',
  } });
  assert.equal(saved[0].record_id, '1');
  assert.equal(saved[0].offense_type, 'No Offense');
  assert.equal(saved[0].course_code, 'BSIT');
  assert.equal(saved[0].year_level, '4');
  assert.equal(saved[0].offense_incident_date, null);
  assert.equal(saved[0].remarks, null);
  assert.equal(saved[0].recorded_by, 'sdo-user');
  assert.equal(updates.at(-1).has_disciplinary_action, false);
});

test('direct edit validates fields and never changes a record identity or writes invalid values', async () => {
  const { service, saved, writes } = harness();
  await service.importSdoDisciplinaryRecordsFile({ file: { originalname: 'one.csv', buffer: Buffer.from('Student Number,Offense Type\nPDM-2023-000001,Minor Offense') } });
  const before = writes.length;
  await assert.rejects(service.updateSdoDisciplinaryRecord({ recordId: '1', values: { offense_type: 'Suspension' } }), /Offense must/);
  await assert.rejects(service.updateSdoDisciplinaryRecord({ recordId: '1', values: { offense_type: 'Major Offense', offense_incident_date: '2014-01-01' } }), /earlier than/);
  await assert.rejects(service.updateSdoDisciplinaryRecord({ recordId: '999', values: {} }), error => error.statusCode === 404);
  assert.equal(writes.length, before);
  assert.equal(saved[0].offense_type, 'Minor Offense');
  await service.updateSdoDisciplinaryRecord({ recordId: '1', values: { student_number: 'PDM-2023-000002', offense_type: 'Major Offense' } });
  assert.equal(saved[0].student_number, 'PDM-2023-000001');
});
