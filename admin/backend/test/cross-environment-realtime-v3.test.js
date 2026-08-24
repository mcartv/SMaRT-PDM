'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin direct relay remains environment-local', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'studentRealtimeRelayService.js'),
    'utf8'
  );

  assert.match(source, /process\.env\.INTERNAL_REALTIME_SECRET/);
  assert.match(source, /process\.env\.STUDENT_BACKEND_BASE_URL/);
  assert.doesNotMatch(source, /smart-pdm-3tbv\.onrender\.com/);
});

test('admin Supabase realtime bridge covers messages and reconnects', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'realtimeBridgeService.js'),
    'utf8'
  );

  assert.match(source, /domain:\s*'messages'/);
  assert.match(source, /table:\s*'messages'/);
  assert.match(source, /scheduleRealtimeBridgeRestart/);
  assert.match(source, /CHANNEL_ERROR/);
  assert.match(source, /TIMED_OUT/);
});
