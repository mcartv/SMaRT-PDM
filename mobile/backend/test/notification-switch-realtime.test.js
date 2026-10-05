'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createBridgeHarness(enabled) {
  const handlers = new Map();
  const events = [];
  let policyReads = 0;
  const channel = {
    on(_event, filter, handler) {
      handlers.set(filter.table, handler);
      return this;
    },
    subscribe() { return this; },
  };
  const io = {
    emit() {},
    to(room) {
      return { emit(name, payload) { events.push({ room, name, payload }); } };
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(
    path.join(__dirname, '../src/services/realtimeBridgeService.js'), 'utf8'
  ), {
    module,
    console: { log() {}, warn() {}, error() {} },
    require(name) {
      assert.equal(name, '../config/notificationPolicy');
      return {
        async notificationsEnabled() { policyReads += 1; return enabled; },
      };
    },
  });
  module.exports.configureRealtimeBridge({ io, supabase: { channel: () => channel } });
  return {
    handle: handlers.get('notifications'), events,
    get policyReads() { return policyReads; },
  };
}

const notification = {
  notification_id: 'notification-1', user_id: 'user-1',
  title: 'Existing notification', message: 'Test',
  created_at: '2026-10-05T00:00:00Z',
};

test('disabled notifications suppress new realtime delivery', async () => {
  const bridge = createBridgeHarness(false);
  await bridge.handle({ eventType: 'INSERT', new: notification, old: {} });
  assert.equal(bridge.events.length, 0);
  assert.equal(bridge.policyReads, 1);
});

test('enabled notifications deliver new notifications to the recipient', async () => {
  const bridge = createBridgeHarness(true);
  await bridge.handle({ eventType: 'INSERT', new: notification, old: {} });
  assert.equal(bridge.events.length, 1);
  assert.equal(bridge.events[0].room, 'user:user-1');
  assert.equal(bridge.events[0].name, 'notification:new');
  assert.equal(bridge.events[0].payload.notification_id, notification.notification_id);
});

test('disabled notifications still sync read state for existing notifications', async () => {
  const bridge = createBridgeHarness(false);
  await bridge.handle({
    eventType: 'UPDATE', new: { ...notification, is_read: true }, old: notification,
  });
  assert.equal(bridge.events.length, 1);
  assert.equal(bridge.events[0].room, 'user:user-1');
  assert.equal(bridge.events[0].name, 'notification:updated');
  assert.equal(bridge.events[0].payload.is_read, true);
  assert.equal(bridge.policyReads, 0);
});

test('disabled notifications still sync deletion using the old recipient', async () => {
  const bridge = createBridgeHarness(false);
  await bridge.handle({ eventType: 'DELETE', new: {}, old: notification });
  assert.equal(bridge.events.length, 1);
  assert.equal(bridge.events[0].room, 'user:user-1');
  assert.equal(bridge.events[0].name, 'notification:deleted');
  assert.equal(bridge.events[0].payload.notification_id, notification.notification_id);
  assert.equal(bridge.policyReads, 0);
});
