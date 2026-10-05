'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(eventIds = ['reminder-1']) {
  let clock = Date.parse('2026-10-05T00:00:00Z');
  let enabled = true;
  let events = eventIds.map(id => ({ id, title: id, date: '2026-10-01', time: '08:00' }));
  const claims = new Map();
  const notifications = [];
  const suppressed = new Set(eventIds);
  const queries = [];
  let releases = 0;
  const client = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [], rowCount: 0 };
      if (/SELECT calendar_events/.test(sql)) return { rows: [{ calendar_events: structuredClone(events) }] };
      if (/INSERT INTO public\.staff_reminder_deliveries/.test(sql)) {
        if (claims.has(values[1])) return { rows: [], rowCount: 0 };
        claims.set(values[1], { notification_id: null });
        return { rows: [{ event_id: values[1] }], rowCount: 1 };
      }
      if (/INSERT INTO public\.notifications/.test(sql)) {
        if (suppressed.has(values[3])) return { rows: [], rowCount: 0 };
        const notification = { notification_id: `notification-${values[3]}` };
        notifications.push(notification);
        return { rows: [notification], rowCount: 1 };
      }
      if (/DELETE FROM public\.staff_reminder_deliveries/.test(sql)) {
        assert.equal(values[0], 'user-1');
        assert.match(sql, /notification_id IS NULL/);
        if (claims.get(values[1])?.notification_id === null) claims.delete(values[1]);
        return { rows: [], rowCount: 1 };
      }
      if (/UPDATE public\.staff_reminder_deliveries/.test(sql)) {
        claims.set(values[1], { notification_id: values[2] });
        return { rows: [], rowCount: 1 };
      }
      if (/UPDATE public\.staff_personal_tools/.test(sql)) {
        events = JSON.parse(values[1]);
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() { releases += 1; },
  };
  const module = { exports: {} };
  class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services/personalToolService.js'), 'utf8'), {
    module, Date: TestDate, Intl,
    require(name) {
      if (name === 'crypto') return require('node:crypto');
      if (name === '../config/notificationPolicy') return { notificationsEnabled: async () => enabled };
      if (name === '../config/db') return {
        async query(sql) { queries.push({ sql }); return { rows: [{ user_id: 'user-1' }] }; },
        async connect() { return client; },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return {
    service: module.exports, claims, notifications, suppressed, queries,
    get events() { return events; }, get releases() { return releases; },
    advance() { clock += 60000; }, setEnabled(value) { enabled = value; },
  };
}

test('suppressed reminder INSERT releases its claim without marking or emitting delivery', async () => {
  const worker = harness();
  const delivered = await worker.service.processDueReminders();
  assert.equal(delivered.length, 0);
  assert.equal(worker.claims.size, 0);
  assert.equal(worker.events[0].notified_at, undefined);
  assert.equal(worker.notifications.length, 0);
  assert.equal(worker.queries.some(({ sql }) => /UPDATE public\.staff_reminder_deliveries|UPDATE public\.staff_personal_tools/.test(sql)), false);
  assert.equal(worker.queries.some(({ sql }) => sql === 'COMMIT'), true);
  assert.equal(worker.queries.some(({ sql }) => sql === 'ROLLBACK'), false);
  assert.equal(worker.releases, 1);
});

test('previously suppressed reminder retries after enabling and delivers exactly once', async () => {
  const worker = harness();
  await worker.service.processDueReminders();
  worker.setEnabled(false);
  worker.advance();
  const priorQueries = worker.queries.length;
  assert.equal((await worker.service.processDueReminders()).length, 0);
  assert.equal(worker.queries.length, priorQueries);
  worker.setEnabled(true);
  worker.suppressed.clear();
  const delivered = await worker.service.processDueReminders();
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].notification.notification_id, 'notification-reminder-1');
  assert.ok(worker.events[0].notified_at);
  assert.equal(worker.claims.get('reminder-1').notification_id, 'notification-reminder-1');
  worker.advance();
  assert.equal((await worker.service.processDueReminders()).length, 0);
  assert.equal(worker.notifications.length, 1);
});

test('suppression leaves successful reminders committed and only the blocked reminder retryable', async () => {
  const worker = harness(['successful', 'blocked']);
  worker.suppressed.delete('successful');
  const delivered = await worker.service.processDueReminders();
  assert.equal(delivered.length, 1);
  assert.ok(worker.events[0].notified_at);
  assert.equal(worker.events[1].notified_at, undefined);
  assert.equal(worker.claims.has('successful'), true);
  assert.equal(worker.claims.has('blocked'), false);
  worker.suppressed.clear();
  worker.advance();
  assert.equal((await worker.service.processDueReminders()).length, 1);
  assert.equal(worker.notifications.length, 2);
  assert.equal(worker.claims.size, 2);
});
