'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(enabled) {
  const routes = new Map();
  const events = [];
  let policyReads = 0;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/routes/internalRealtimeRoutes.js'), 'utf8'), {
    module, console, Date,
    require(name) {
      if (name === 'express') return { Router: () => ({ post(route, ...handlers) { routes.set(route, handlers); } }) };
      if (name === '../utils/internalRealtimeSecret') return { resolveInternalRealtimeSecret: () => 'test-secret' };
      if (name === '../config/notificationPolicy') return {
        notificationsEnabled: async () => { policyReads += 1; return enabled; },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return {
    events,
    get policyReads() { return policyReads; },
    async request(event, { secret = 'test-secret', notifications = [{ notification_id: 'n1', user_id: 'u1', is_read: true }] } = {}) {
      const response = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      const request = {
        headers: { 'x-internal-realtime-secret': secret }, body: { event, notifications },
        app: { get: () => ({ to: room => ({ emit: (name, payload) => events.push({ room, name, payload }) }) }) },
      };
      const [auth, handler] = routes.get('/notification-batch');
      let authorized = false;
      auth(request, response, () => { authorized = true; });
      if (authorized) await handler(request, response);
      return response;
    },
  };
}

for (const enabled of [false, true]) {
  for (const event of ['notification:new', 'notification:created', 'notification:updated']) {
    test(`notification batch: ${enabled ? 'ON' : 'OFF'} + ${event}`, async () => {
      const route = harness(enabled);
      const result = await route.request(event);
      const allowed = enabled || event === 'notification:updated';
      assert.equal(result.code, 200);
      assert.equal(result.body.emitted, allowed ? 1 : 0);
      assert.equal(route.events.length, allowed ? 1 : 0);
      assert.equal(route.policyReads, event === 'notification:updated' ? 0 : 1);
      if (allowed) {
        assert.equal(route.events[0].name, event);
        assert.equal(route.events[0].room, 'user:u1');
        assert.equal(route.events[0].payload.is_read, true);
      } else assert.equal(result.body.skipped, true);
    });
  }
}

test('OFF never bypasses internal authentication or allowed-event validation', async () => {
  const route = harness(false);
  assert.equal((await route.request('notification:updated', { secret: 'wrong' })).code, 401);
  assert.equal((await route.request('notification:deleted')).code, 400);
  assert.equal(route.policyReads, 0);
  assert.equal(route.events.length, 0);
});

test('OFF updates still enforce batch limits and recipient validation', async () => {
  const route = harness(false);
  assert.equal((await route.request('notification:updated', { notifications: [] })).code, 400);
  assert.equal((await route.request('notification:updated', { notifications: Array(501).fill({}) })).code, 400);
  const result = await route.request('notification:updated', { notifications: [{ user_id: 'u1' }, null, { notification_id: 'n1' }] });
  assert.equal(result.body.emitted, 0);
  assert.equal(route.events.length, 0);
});
