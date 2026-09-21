'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('registry import chunks writes and completes a batch with one database update', async () => {
  const supabasePath = require.resolve('../config/supabase');
  const dbPath = require.resolve('../config/db');
  const servicePath = require.resolve('../services/studentRegistryService');
  const previousSupabase = require.cache[supabasePath];
  const previousDb = require.cache[dbPath];
  const previousService = require.cache[servicePath];
  const inserted = [];
  const upserted = [];
  const completed = [];
  const batchId = '00000000-0000-0000-0000-000000000001';
  const mockSupabase = {
    from(table) {
      return {
        select() {
          assert.equal(table, 'academic_course');
          return { eq: async () => ({ data: [], error: null }) };
        },
        insert(payload) {
          if (table === 'student_import_batches') {
            return { select: () => ({ single: async () => ({ data: { import_batch_id: batchId }, error: null }) }) };
          }
          assert.equal(table, 'student_import_rows');
          inserted.push(payload);
          return Promise.resolve({ error: null });
        },
        upsert(payload) {
          assert.equal(table, 'student_master_records');
          upserted.push(payload);
          return Promise.resolve({ error: null });
        },
        update() {
          assert.equal(table, 'student_import_batches');
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  };
  require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: mockSupabase };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      query: async (sql, values) => {
        completed.push({ sql, values });
        return { rows: [{ imported: 401, failed: 0 }] };
      },
    },
  };
  delete require.cache[servicePath];

  try {
    const { importStudentRegistryFile } = require(servicePath);
    const csv = [
      'Student Number,First Name,Surname,Course,Year Level',
      ...Array.from({ length: 401 }, (_, index) => `PDM${index + 1},First${index + 1},Last${index + 1},BSIT,1`),
    ].join('\n');
    const result = await importStudentRegistryFile({
      file: { originalname: 'registry.csv', buffer: Buffer.from(csv) },
      adminId: null,
    });

    assert.deepEqual(inserted.map((chunk) => chunk.length), [200, 200, 1]);
    assert.deepEqual(upserted.map((chunk) => chunk.length), [200, 200, 1]);
    assert.equal(completed.length, 1);
    assert.deepEqual(completed[0].values, [batchId]);
    assert.match(completed[0].sql, /UPDATE student_import_rows/);
    assert.equal(result.imported, 401);
    assert.equal(result.failed_rows, 0);
    assert.equal(upserted[0][0].raw_snapshot['First Name'], 'First1');
  } finally {
    if (previousSupabase) require.cache[supabasePath] = previousSupabase;
    else delete require.cache[supabasePath];
    if (previousDb) require.cache[dbPath] = previousDb;
    else delete require.cache[dbPath];
    if (previousService) require.cache[servicePath] = previousService;
    else delete require.cache[servicePath];
  }
});
