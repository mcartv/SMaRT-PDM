'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('an identity-conflict row cannot mutate its master/account while valid rows continue', async () => {
  const supabasePath = require.resolve('../config/supabase');
  const dbPath = require.resolve('../config/db');
  const servicePath = require.resolve('../services/studentRegistryService');
  const previousSupabase = require.cache[supabasePath];
  const previousDb = require.cache[dbPath];
  const previousService = require.cache[servicePath];
  const batchId = '00000000-0000-0000-0000-000000000099';
  const upserted = [];
  const failedUpdates = [];
  const syncQueries = [];

  const mockSupabase = {
    from(table) {
      return {
        select() {
          if (table === 'academic_course') {
            return {
              eq: async () => ({
                data: [{ course_id: 'course-bs-it', course_code: 'BSIT', course_name: 'BS Information Technology' }],
                error: null,
              }),
            };
          }
          throw new Error(`Unexpected select for ${table}`);
        },
        insert() {
          if (table === 'student_import_batches') {
            return {
              select: () => ({
                single: async () => ({ data: { import_batch_id: batchId }, error: null }),
              }),
            };
          }
          assert.equal(table, 'student_import_rows');
          return Promise.resolve({ error: null });
        },
        upsert(payload) {
          assert.equal(table, 'student_master_records');
          upserted.push(...payload);
          return Promise.resolve({ error: null });
        },
        update() {
          assert.equal(table, 'student_import_batches');
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  };

  const existing = {
    master_student_id: 'master-existing',
    student_number: 'PDM-2026-000125',
    pdm_id: 'PDM-2026-000125',
    learners_reference_number: '123456789012',
    first_name: 'Juan',
    middle_name: 'Santos',
    last_name: 'Dela Cruz',
    date_of_birth: '2008-05-20',
  };

  const mockDb = {
    async query(sql, values) {
      if (/SELECT[\s\S]*master\.learners_reference_number[\s\S]*FROM student_master_records AS master/.test(sql)) {
        return { rows: [existing] };
      }
      if (/UPDATE student_import_rows AS import_row[\s\S]*jsonb_to_recordset/.test(sql)) {
        failedUpdates.push(...JSON.parse(values[1]));
        return { rows: [] };
      }
      if (/SELECT[\s\S]*raw_snapshot[\s\S]*FROM student_master_records/.test(sql)) {
        return { rows: [] };
      }
      if (/UPDATE students AS student/.test(sql)) {
        syncQueries.push(sql);
        return { rows: [] };
      }
      if (/count\(\*\) FILTER \(WHERE status = 'imported'\)/.test(sql)) {
        return { rows: [{ imported: 1, failed: 1 }] };
      }
      if (/AND import_row\.status = 'failed'/.test(sql)) {
        return {
          rows: [{
            row_number: 2,
            student_number: 'PDM-2026-000125',
            pdm_id: 'PDM-2026-000125',
            learners_reference_number: '987654321012',
            given_name: 'Maria Anne',
            middle_name: null,
            last_name: 'Reyes',
            date_of_birth: '2008-05-20',
            status: 'failed',
            error_message: failedUpdates[0].error_message,
            matched_master_student_id: null,
            existing_student_number: existing.student_number,
            existing_lrn: existing.learners_reference_number,
            existing_first_name: existing.first_name,
            existing_middle_name: existing.middle_name,
            existing_last_name: existing.last_name,
            existing_date_of_birth: existing.date_of_birth,
          }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: mockSupabase };
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb };
  delete require.cache[servicePath];

  try {
    const { importStudentRegistryFile } = require(servicePath);
    const csv = [
      'Student Number,LRN,First Name,Middle Name,Surname,Date of Birth,Course',
      'PDM-2026-000125,987654321012,Maria Anne,,Reyes,05/20/2008,BSIT',
      'PDM-2026-000842,555555555555,Juan,Santos,Dela Cruz,05/20/2008,BSIT',
    ].join('\n');

    const result = await importStudentRegistryFile({
      file: { originalname: 'mixed-registry.csv', buffer: Buffer.from(csv) },
      adminId: 'admin-1',
    });

    assert.deepEqual(upserted.map((row) => row.student_number), ['PDM-2026-000842']);
    assert.equal(upserted.some((row) => row.student_number === existing.student_number), false);
    assert.equal(failedUpdates.length, 1);
    assert.match(failedUpdates[0].error_message, /identity conflict/i);
    assert.match(failedUpdates[0].error_message, /matching birthday alone is not sufficient/i);
    assert.equal(syncQueries.length, 1);
    assert.doesNotMatch(syncQueries[0], /\bpdm_id\s*=/);
    assert.equal(result.imported, 1);
    assert.equal(result.added, 1);
    assert.equal(result.updated, 0);
    assert.equal(result.failed_rows, 1);
    assert.equal(result.failed_results[0].matched_master_student_id, null);
    assert.equal(result.failed_results[0].existing_record.name, 'Juan Santos Dela Cruz');
    assert.equal(result.failed_results[0].uploaded_record.name, 'Maria Anne Reyes');
  } finally {
    if (previousSupabase) require.cache[supabasePath] = previousSupabase;
    else delete require.cache[supabasePath];
    if (previousDb) require.cache[dbPath] = previousDb;
    else delete require.cache[dbPath];
    if (previousService) require.cache[servicePath] = previousService;
    else delete require.cache[servicePath];
  }
});
