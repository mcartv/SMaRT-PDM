'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { read } = require('./_current-system-test-utils');

function loadSettings(currentDeadline, now = '2026-10-07T16:30:00Z', missing = false) {
  const writes = [];
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }
  }
  const query = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() {
      return { data: missing ? null : { global_deadline: currentDeadline }, error: null };
    },
    upsert(payload) { writes.push(payload); return this; },
    async single() { return { data: writes.at(-1), error: null }; },
  };
  const context = vm.createContext({
    Date: FixedDate,
    module: { exports: {} },
    require(name) {
      if (name === '../config/supabase') return { from: () => query };
      if (name === '../config/notificationPolicy') return { setNotificationsEnabled() {} };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  vm.runInContext(read('backend/services/generalSettingService.js'), context);
  return { service: context.module.exports, writes };
}

const actor = { role: 'admin', user_id: 'admin-test' };

test('changed global deadlines reject past dates before writing settings', async () => {
  const { service, writes } = loadSettings('2026-03-31');
  await assert.rejects(service.updateGeneralSettings({ global_deadline: '2026-10-07' }, actor), {
    statusCode: 400,
    message: 'Global deadline cannot be in the past. Please select today or a future date.',
  });
  assert.equal(writes.length, 0);
});

test('today and future global deadlines are saved using Manila time', async () => {
  for (const deadline of ['2026-10-08', '2026-10-09']) {
    const { service } = loadSettings('2026-03-31');
    const saved = await service.updateGeneralSettings({ global_deadline: deadline }, actor);
    assert.equal(saved.global_deadline, deadline);
  }
});

test('an existing expired deadline remains visible and can be saved unchanged', async () => {
  const { service } = loadSettings('2026-03-31');
  assert.equal((await service.getGeneralSettings()).global_deadline, '2026-03-31');
  const saved = await service.updateGeneralSettings({ global_deadline: '2026-03-31', applications_open: false }, actor);
  assert.equal(saved.global_deadline, '2026-03-31');
  assert.equal(saved.applications_open, false);
});

test('unrelated settings preserve expired and absent deadlines', async () => {
  for (const deadline of ['2026-03-31', null]) {
    const { service } = loadSettings(deadline);
    const saved = await service.updateGeneralSettings({ notifications_enabled: false }, actor);
    assert.equal(saved.global_deadline, deadline);
    assert.equal(saved.notifications_enabled, false);
  }
});

test('changed deadlines reject missing, malformed and impossible dates', async () => {
  for (const deadline of ['', null, '10/08/2026', '2026-02-30']) {
    const { service, writes } = loadSettings('2026-03-31');
    await assert.rejects(service.updateGeneralSettings({ global_deadline: deadline }, actor), { statusCode: 400 });
    assert.equal(writes.length, 0);
  }
});

test('deadline validation advances at midnight in Manila', async () => {
  const before = loadSettings('2026-03-31', '2026-10-07T15:59:59Z');
  assert.equal((await before.service.updateGeneralSettings({ global_deadline: '2026-10-07' }, actor)).global_deadline, '2026-10-07');
  const after = loadSettings('2026-03-31', '2026-10-07T16:00:00Z');
  await assert.rejects(after.service.updateGeneralSettings({ global_deadline: '2026-10-07' }, actor), { statusCode: 400 });
});

test('a new settings record defaults its deadline to today', async () => {
  const { service } = loadSettings(null, '2026-10-07T16:30:00Z', true);
  assert.equal((await service.getGeneralSettings()).global_deadline, '2026-10-08');
  const saved = await service.updateGeneralSettings({ applications_open: false }, actor);
  assert.equal(saved.global_deadline, '2026-10-08');
});

test('application form restricts new dates and omits unchanged deadlines', () => {
  const page = read('frontend/src/pages/maintenance/GeneralPanel.jsx');
  assert.match(page, /min=\{getManilaToday\(\)\}/);
  assert.match(page, /globalDeadline < getManilaToday\(\)/);
  assert.match(page, /globalDeadline !== savedGlobalDeadline \? \{ global_deadline: globalDeadline \} : \{\}/);
  assert.match(page, /setGlobalDeadline\(getManilaToday\(\)\)/);
});
