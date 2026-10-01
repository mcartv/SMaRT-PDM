'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('populated rows missing required identity fields are tracked as failed instead of silently dropped', async () => {
  const supabasePath = require.resolve('../config/supabase');
  const dbPath = require.resolve('../config/db');
  const servicePath = require.resolve('../services/studentRegistryService');
  const previousSupabase = require.cache[supabasePath];
  const previousDb = require.cache[dbPath];
  const previousService = require.cache[servicePath];
  const batchId = '00000000-0000-0000-0000-000000000123';
  const insertedRows = [];
  const upserted = [];

  const mockSupabase = {
    from(table) {
      return {
        select() {
          if (table === 'academic_course') {
            return {
              eq: async () => ({
                data: [{
                  course_id: 'course-bs-it',
                  course_code: 'BSIT',
                  course_name: 'BS Information Technology',
                }],
                error: null,
              }),
            };
          }
          throw new Error(`Unexpected select for ${table}`);
        },
        insert(payload) {
          if (table === 'student_import_batches') {
            return {
              select: () => ({
                single: async () => ({
                  data: { import_batch_id: batchId },
                  error: null,
                }),
              }),
            };
          }
          assert.equal(table, 'student_import_rows');
          insertedRows.push(...payload);
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

  const mockDb = {
    async query(sql) {
      if (/SELECT[\s\S]*master\.learners_reference_number[\s\S]*FROM student_master_records AS master/.test(sql)) {
        return { rows: [] };
      }
      if (/SELECT[\s\S]*raw_snapshot[\s\S]*FROM student_master_records/.test(sql)) {
        return { rows: [] };
      }
      if (/UPDATE students AS student/.test(sql)) {
        return { rows: [] };
      }
      if (/count\(\*\) FILTER \(WHERE status = 'imported'\)/.test(sql)) {
        return { rows: [{ imported: 1, failed: 3 }] };
      }
      if (/AND import_row\.status = 'failed'/.test(sql)) {
        return {
          rows: insertedRows
            .filter((row) => row.status === 'failed')
            .map((row) => ({
              row_number: row.row_number,
              student_number: row.student_number,
              pdm_id: row.pdm_id,
              learners_reference_number: row.learners_reference_number,
              given_name: row.given_name,
              middle_name: row.middle_name,
              last_name: row.last_name,
              date_of_birth: row.date_of_birth,
              status: row.status,
              error_message: row.error_message,
              matched_master_student_id: null,
              existing_student_number: null,
              existing_lrn: null,
              existing_first_name: null,
              existing_middle_name: null,
              existing_last_name: null,
              existing_date_of_birth: null,
            })),
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  require.cache[supabasePath] = {
    id: supabasePath,
    filename: supabasePath,
    loaded: true,
    exports: mockSupabase,
  };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: mockDb,
  };
  delete require.cache[servicePath];

  try {
    const { importStudentRegistryFile } = require(servicePath);
    const csv = [
      'Student Number,First Name,Surname,Course',
      ',Maria,Reyes,BSIT',
      'PDM-2026-000201,,Reyes,BSIT',
      'PDM-2026-000202,Juan,,BSIT',
      'PDM-2026-000203,Carlo,Santos,BSIT',
    ].join('\n');

    const result = await importStudentRegistryFile({
      file: {
        originalname: 'required-field-registry.csv',
        buffer: Buffer.from(csv),
      },
      adminId: 'admin-1',
    });

    assert.equal(insertedRows.length, 4);
    assert.deepEqual(
      insertedRows.map((row) => row.status),
      ['failed', 'failed', 'failed', 'validated']
    );
    assert.match(insertedRows[0].error_message, /PDM ID \/ Student Number is required/i);
    assert.match(insertedRows[1].error_message, /First Name \/ Given Name is required/i);
    assert.match(insertedRows[2].error_message, /Surname \/ Last Name is required/i);

    assert.deepEqual(
      upserted.map((row) => row.student_number),
      ['PDM-2026-000203']
    );

    assert.equal(result.total, 4);
    assert.equal(result.imported, 1);
    assert.equal(result.added, 1);
    assert.equal(result.updated, 0);
    assert.equal(result.failed_rows, 3);
    assert.equal(result.failed_results.length, 3);
    assert.equal(result.failed_results[0].result, 'Missing PDM ID');
    assert.equal(result.failed_results[1].result, 'Invalid required field');
    assert.equal(result.failed_results[2].result, 'Invalid required field');
  } finally {
    if (previousSupabase) require.cache[supabasePath] = previousSupabase;
    else delete require.cache[supabasePath];
    if (previousDb) require.cache[dbPath] = previousDb;
    else delete require.cache[dbPath];
    if (previousService) require.cache[servicePath] = previousService;
    else delete require.cache[servicePath];
  }
});
