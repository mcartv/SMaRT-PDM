const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/services/profileService.js'), 'utf8');
const setup = source.slice(source.indexOf('async function setupMyProfile('), source.indexOf('async function updateMyProfile('));

function harness() {
  let committed = { complete: false, phone: 'old', address: null };
  let pending;
  let failProfile = true;
  let released = 0;
  let connections = 0;
  const client = {
    async query(sql, values) {
      if (sql === 'BEGIN') pending = { ...committed };
      else if (sql === 'COMMIT') committed = pending;
      else if (sql === 'ROLLBACK') pending = null;
      else if (sql.startsWith('SELECT student_id')) return { rows: [{ student_id: 'student', is_profile_complete: pending.complete }] };
      else if (sql.startsWith('UPDATE users')) pending.phone = values[0];
      else if (sql.startsWith('INSERT INTO student_profiles')) {
        if (failProfile) throw new Error('Profile write failed');
        pending.address = values[1];
      } else if (sql.startsWith('UPDATE students')) pending.complete = true;
      else throw new Error(`Unexpected SQL: ${sql}`);
      return { rows: [] };
    },
    release() { released++; },
  };
  const context = {
    db: { connect: async () => { connections++; return client; } },
    createHttpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
    safeText: (value) => String(value ?? '').trim(),
    getMyProfile: async () => ({ ...committed }),
  };
  vm.createContext(context);
  vm.runInContext(setup, context);
  return {
    run: () => context.setupMyProfile('user', { phone_number: 'new', street_address: 'new street' }),
    runWith: (payload) => context.setupMyProfile('user', payload),
    state: () => committed,
    allowSave: () => { failProfile = false; },
    releases: () => released,
    connections: () => connections,
  };
}

test('failed profile details roll back contact changes and allow setup retry', async () => {
  const h = harness();
  await assert.rejects(h.run(), /Profile write failed/);
  assert.deepEqual(h.state(), { complete: false, phone: 'old', address: null });
  h.allowSave();
  await h.run();
  assert.deepEqual(h.state(), { complete: true, phone: 'new', address: 'new street' });
  await assert.rejects(h.run(), /already complete/);
  assert.equal(h.releases(), 3);
});

test('profile setup rejects values outside database constraints before connecting', async () => {
  const h = harness();
  await assert.rejects(h.runWith({ year_level: 7 }), { statusCode: 400 });
  await assert.rejects(h.runWith({ year_level: 2.5 }), { statusCode: 400 });
  await assert.rejects(h.runWith({ civil_status: 'Partnered' }), { statusCode: 400 });
  await assert.rejects(h.runWith({ financial_support_type: 'Employer' }), { statusCode: 400 });
  assert.equal(h.connections(), 0);
});
