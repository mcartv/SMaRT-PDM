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

test('System Logs uses server-side pagination and resets filtered results to page one', () => {
  const panel = read('frontend/src/pages/maintenance/AuditPanel.jsx');
  const service = read('backend/services/auditLogService.js');

  assert.match(panel, /const PAGE_SIZE = 25;/);
  assert.match(panel, /params\.set\('limit', String\(PAGE_SIZE\)\)/);
  assert.match(panel, /params\.set\('offset', String\(\(page - 1\) \* PAGE_SIZE\)\)/);
  assert.match(panel, /Showing \{firstVisibleLog\.toLocaleString\(\)\}/);
  assert.match(panel, /Page \{page\} of \{totalPages\}/);
  assert.match(panel, /setPage\(1\);[\s\S]*setDebouncedSearch\(search\)/);
  assert.match(service, /select count\(\*\)::int as total/i);
  assert.match(service, /limit \$\$?\{?pageValues\.length - 1\}?/i);
  assert.match(service, /offset \$\$?\{?pageValues\.length\}?/i);
});
