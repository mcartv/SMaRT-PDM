const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const maintenanceSource = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/maintenance/Maintenance.jsx'),
  'utf8'
);

const auditSource = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/maintenance/AuditPanel.jsx'),
  'utf8'
);

const backendSource = fs.readFileSync(
  path.resolve(__dirname, '../services/auditLogService.js'),
  'utf8'
);

test('maintenance navigation uses Audit Trail label', () => {
  assert.match(
    maintenanceSource,
    /\{\s*key:\s*'audit',\s*label:\s*'Audit Trail'/
  );
});

test('audit page consistently uses Audit Trail wording', () => {
  assert.match(auditSource, /Audit Trail Access Restricted/);
  assert.match(auditSource, /Unlock Audit Trail/);
  assert.match(auditSource, /Administrative Activity/);
  assert.match(auditSource, /Loading audit trail/);
  assert.match(auditSource, /No audit trail records found/);
});

test('audit search placeholder is renamed', () => {
  assert.match(
    auditSource,
    /Search audit trail by action, user, or module/
  );
});

test('audit export labels and filename use Audit Trail', () => {
  assert.match(auditSource, /Export Audit Trail/);
  assert.match(auditSource, /audit-trail-/);
  assert.match(auditSource, /text\/csv/);
});

test('audit trail has an explicit empty state', () => {
  assert.match(auditSource, /No audit trail records found/);
  assert.match(
    auditSource,
    /Administrative actions will appear here once recorded/
  );
});

test('backend audit logging remains untouched conceptually', () => {
  assert.match(backendSource, /audit/i);
  assert.match(backendSource, /logAudit|audit_logs|audit_log/i);
});
