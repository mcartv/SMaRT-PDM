'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('System Logs is the current user-facing maintenance terminology', () => {
  const maintenance = read('frontend/src/pages/maintenance/Maintenance.jsx');
  const panel = read('frontend/src/pages/maintenance/AuditPanel.jsx');

  assert.match(maintenance, /label:\s*'System Logs'/);
  assert.match(panel, /System Logs/);
});

test('System Logs still uses the existing audit-log backend contract internally', () => {
  const panel = read('frontend/src/pages/maintenance/AuditPanel.jsx');

  assert.match(panel, /audit-logs/);
  assert.match(panel, /Search|search/i);
  assert.match(panel, /Export|export/i);
});
