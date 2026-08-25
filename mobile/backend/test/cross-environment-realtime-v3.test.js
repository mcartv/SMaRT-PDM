'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  isAllowedSocketOrigin,
} = require('../src/config/socketOriginPolicy');

test('Flutter Web random localhost/LAN origins are accepted without loading backend env', () => {
  assert.equal(isAllowedSocketOrigin('http://localhost:55231'), true);
  assert.equal(isAllowedSocketOrigin('http://127.0.0.1:61321'), true);
  assert.equal(isAllowedSocketOrigin('http://192.168.100.9:55231'), true);
  assert.equal(isAllowedSocketOrigin('https://smart-pdm.vercel.app'), true);
  assert.equal(isAllowedSocketOrigin('https://untrusted.invalid'), false);
});

test('mobile Supabase messages bridge is present and self-recovers', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'realtimeBridgeService.js'),
    'utf8'
  );

  assert.match(source, /table:\s*'messages'/);
  assert.match(source, /scheduleRealtimeBridgeRestart/);
  assert.match(source, /CHANNEL_ERROR/);
  assert.match(source, /TIMED_OUT/);
});

test('mobile direct relay remains environment-local', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'adminRealtimeRelayService.js'),
    'utf8'
  );

  assert.match(source, /process\.env\.INTERNAL_REALTIME_SECRET/);
  assert.match(source, /process\.env\.ADMIN_BACKEND_URL/);
  assert.doesNotMatch(source, /smart-pdm\.onrender\.com/);
});
