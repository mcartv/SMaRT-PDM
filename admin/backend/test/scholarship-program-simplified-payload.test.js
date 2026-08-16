const test = require('node:test');
const assert = require('node:assert/strict');

const supabasePath = require.resolve('../config/supabase');
const servicePath = require.resolve('../services/scholarshipProgramService');

function createFakeSupabase() {
  const state = {
    insertedProgramPayload: null,
  };

  const benefactorRow = {
    benefactor_id: '11111111-1111-4111-8111-111111111111',
    benefactor_name: 'Example Benefactor',
    benefactor_type: 'Private',
    is_archived: false,
  };

  const fake = {
    from(table) {
      if (table === 'benefactors') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            return {
              data: benefactorRow,
              error: null,
            };
          },
        };
      }

      if (table === 'scholarship_program') {
        return {
          insert(rows) {
            state.insertedProgramPayload = rows[0];

            return {
              select() {
                return this;
              },
              async single() {
                return {
                  data: {
                    program_id: '22222222-2222-4222-8222-222222222222',
                    ...state.insertedProgramPayload,
                    created_at: '2026-08-16T00:00:00.000Z',
                    updated_at: '2026-08-16T00:00:00.000Z',
                    benefactors: benefactorRow,
                  },
                  error: null,
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { fake, state };
}

test('backend accepts simplified program template and ignores legacy allocation fields', async () => {
  const { fake, state } = createFakeSupabase();

  const previousSupabaseCache = require.cache[supabasePath];
  const previousServiceCache = require.cache[servicePath];

  try {
    require.cache[supabasePath] = {
      id: supabasePath,
      filename: supabasePath,
      loaded: true,
      exports: fake,
      children: [],
      paths: [],
    };

    delete require.cache[servicePath];
    const service = require(servicePath);

    const result = await service.createScholarshipProgram({
      benefactor_id: '11111111-1111-4111-8111-111111111111',
      program_name: 'Clean Scholarship Template',
      description: 'Reusable scholarship program definition.',
      target_audience: 'Applicants',
      gwa_threshold: null,
      renewal_cycle: 'Semester',
      visibility_status: 'Published',
      is_archived: false,
      allocated_slots: 999,
      financial_allocation: 500000,
      per_scholar_amount: 25000,
    });

    assert.equal(result.program_name, 'Clean Scholarship Template');

    assert.deepEqual(
      Object.keys(state.insertedProgramPayload).sort(),
      [
        'benefactor_id',
        'description',
        'gwa_threshold',
        'is_archived',
        'program_name',
        'renewal_cycle',
        'target_audience',
        'visibility_status',
      ].sort()
    );

    assert.equal('allocated_slots' in state.insertedProgramPayload, false);
    assert.equal('financial_allocation' in state.insertedProgramPayload, false);
    assert.equal('per_scholar_amount' in state.insertedProgramPayload, false);
  } finally {
    delete require.cache[servicePath];

    if (previousServiceCache) {
      require.cache[servicePath] = previousServiceCache;
    }

    if (previousSupabaseCache) {
      require.cache[supabasePath] = previousSupabaseCache;
    } else {
      delete require.cache[supabasePath];
    }
  }
});
