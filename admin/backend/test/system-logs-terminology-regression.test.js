const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const maintenanceSource = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/maintenance/Maintenance.jsx'),
  'utf8'
);

const panelSource = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/maintenance/AuditPanel.jsx'),
  'utf8'
);

test('maintenance navigation is named System Logs', () => {
  assert.match(
    maintenanceSource,
    /\{\s*key:\s*'audit',\s*label:\s*'System Logs'/
  );
});

test('log viewer uses System Logs terminology', () => {
  assert.match(panelSource, /System Logs Access Restricted/);
  assert.match(panelSource, /Unlock System Logs/);
  assert.match(panelSource, /Search system logs by action, user, or module/);
  assert.match(panelSource, /No system logs found/);
  assert.match(panelSource, /Export System Logs/);
  assert.match(panelSource, /system-logs-/);
});

test('backend audit-log route remains unchanged', () => {
  assert.match(panelSource, /\/api\/audit-logs/);
  assert.match(panelSource, /x-audit-access-token/);
});
