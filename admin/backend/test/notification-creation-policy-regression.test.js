'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');

function serviceHarness(enabled, { suppressed = false } = {}) {
  const operations = [];
  const dependencies = {
    '../config/notificationPolicy': { notificationsEnabled: async () => enabled },
    '../config/db': {}, '../utils/staffRoles': {}, './studentRealtimeRelayService': {},
    './adminRealtimeRelayService': { relayNotificationCreated() { throw new Error('Unexpected relay'); } },
    './pushNotificationService': { sendUserNotificationPush() { throw new Error('Unexpected push'); } },
    crypto: require('node:crypto'),
    '../config/supabase': {
      from(table) {
        const operation = { table, kind: 'select' };
        const builder = {
          select() { return builder; }, eq() { return builder; }, ilike() { return builder; },
          in(column, values) { operation.ids = values; return builder; },
          delete() { operation.kind = 'delete'; return builder; },
          update(payload) { operation.kind = 'update'; operation.payload = payload; return builder; },
          insert(payload) { operation.kind = 'insert'; operation.payload = payload; return builder; },
          maybeSingle() { return builder; },
          single() { throw new Error('Suppressed inserts must not require a returned row'); },
          then(resolve) {
            operations.push(operation);
            let data = [];
            if (table === 'students') data = [{ user_id: 'existing' }, { user_id: 'new' }];
            else if (operation.kind === 'select') data = [
              { notification_id: 'keep', user_id: 'existing' },
              { notification_id: 'stale', user_id: 'former-recipient' },
            ];
            else if (operation.kind === 'update') data = [{ notification_id: 'keep' }];
            else if (operation.kind === 'insert') data = suppressed ? null : [{ notification_id: 'new-card' }];
            return Promise.resolve({ data, error: null }).then(resolve);
          },
        };
        return builder;
      },
    },
  };
  return {
    operations,
    load(relative) {
      const module = { exports: {} };
      vm.runInNewContext(fs.readFileSync(path.join(root, relative), 'utf8'), {
        module, exports: module.exports, Date, console,
        require(name) {
          if (Object.hasOwn(dependencies, name)) return dependencies[name];
          throw new Error(`Unexpected dependency: ${name}`);
        },
      });
      return module.exports;
    },
  };
}

for (const enabled of [false, true]) {
  test(`announcement synchronization ${enabled ? 'ON' : 'OFF'} preserves edits and cleanup`, async () => {
    const harness = serviceHarness(enabled);
    const service = harness.load('admin/backend/services/notificationService.js');
    const result = await service.syncAnnouncementNotifications({ audience: 'all', title: 'Edited', message: 'Updated', referenceId: 'announcement' });
    assert.equal(result.inserted, enabled ? 1 : 0);
    assert.equal(result.updated, 1);
    assert.equal(result.removedStale, true);
    const updates = harness.operations.filter(x => x.kind === 'update');
    assert.deepEqual(Object.keys(updates[0].payload).sort(), ['message', 'title']);
    assert.deepEqual(Array.from(updates[0].ids), ['keep']);
    assert.deepEqual(Array.from(harness.operations.find(x => x.kind === 'delete').ids), ['stale']);
    assert.equal(harness.operations.filter(x => x.kind === 'insert').length, enabled ? 1 : 0);
    if (enabled) assert.equal(harness.operations.find(x => x.kind === 'insert').payload[0].user_id, 'new');
  });
}

for (const backend of ['admin/backend', 'mobile/backend/src']) {
  test(`${backend}: database-suppressed INSERT returns null without delivery`, async () => {
    const harness = serviceHarness(true, { suppressed: true });
    const service = harness.load(`${backend}/services/notificationService.js`);
    assert.equal(await service.createUserNotification({ userId: 'user', type: 'General', title: 'Test', message: 'Test' }), null);
    assert.equal(harness.operations.length, 1);
  });
}

test('application fallback keeps one policy check and accepts database suppression', () => {
  const source = fs.readFileSync(path.join(root, 'admin/backend/services/applicationService.js'), 'utf8');
  const fallback = source.slice(source.indexOf('async function insertNotificationFallback('), source.indexOf('async function deliverVerificationOutcomeNotification('));
  assert.equal((fallback.match(/notificationsEnabled\(\)/g) || []).length, 1);
  assert.match(fallback, /\.maybeSingle\(\)/);
});

test('migration changes only the shared helper guard and announcement fanout in existing functions', () => {
  const baseline = fs.readFileSync(path.join(root, 'supabase/tests/fixtures/notification_policy_baseline.sql'), 'utf8');
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261004171730_enforce_global_notification_creation_policy.sql'), 'utf8');
  const extract = (source, name) => source.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$function\\$;`))[0];
  const originalHelper = extract(baseline, 'create_notification');
  const migratedHelper = extract(migration, 'create_notification').replace(/    -- Pause creation only; helpers inherit this before flood-guard work\.\r?\n    IF COALESCE[\s\S]*?    END IF;\r?\n\r?\n/, '');
  assert.equal(migratedHelper.replace(/\r/g, ''), originalHelper.replace(/\r/g, ''));
  const migratedAnnouncement = extract(migration, 'notify_announcement_published')
    .replace(/    -- Existing-card UPDATE\/DELETE above must continue while creation is OFF\.\r?\n    IF COALESCE[^\n]*\n([\s\S]*?)    END IF;\r?\n\r?\n    return new;/, (_match, fanout) => fanout.replace(/^    /gm, '') + '\n    return new;');
  assert.equal(migratedAnnouncement.replace(/\r/g, ''), extract(baseline, 'notify_announcement_published').replace(/\r/g, ''));
  assert.match(migration, /BEFORE INSERT ON public\.notifications/);
  assert.doesNotMatch(migration, /BEFORE (UPDATE|DELETE)|CREATE TABLE|DROP TABLE|DROP TRIGGER|is_read\s*=/i);
});
