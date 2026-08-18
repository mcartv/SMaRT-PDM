'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('Maintenance uses System Logs as the current user-facing name', () => {
  const maintenance = read('frontend/src/pages/maintenance/Maintenance.jsx');
  const panel = read('frontend/src/pages/maintenance/AuditPanel.jsx');

  assert.match(maintenance, /label:\s*'System Logs'/);
  assert.match(panel, /System Logs/);
  assert.doesNotMatch(maintenance, /label:\s*'Audit Trail'/);
});

test('internal audit-log API naming remains compatible with the backend', () => {
  const panel = read('frontend/src/pages/maintenance/AuditPanel.jsx');

  assert.match(panel, /audit-logs/);
});
