'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('Admin-assisted account password reset is explicitly audited without password material', () => {
  const controller = read('backend/controllers/accountController.js');
  const resetAuditStart = controller.indexOf("actionTaken: 'RESET_ACCOUNT_PASSWORD'");

  assert.ok(resetAuditStart >= 0, 'explicit password reset audit event should exist');
  const auditBlock = controller.slice(resetAuditStart, resetAuditStart + 900);

  assert.match(auditBlock, /module: 'Accounts'/);
  assert.match(auditBlock, /target_user_id/);
  assert.match(auditBlock, /target_email/);
  assert.match(auditBlock, /target_role/);
  assert.match(auditBlock, /session_invalidated/);
  assert.doesNotMatch(auditBlock, /req\.body\?\.password|newPassword|password_hash|confirm_password/);
});

test('Admin-assisted password reset revokes existing sessions', () => {
  const service = read('backend/services/accountService.js');
  const controller = read('backend/controllers/accountController.js');

  assert.match(service, /const passwordChanged = Boolean\(validPassword\)/);
  assert.match(service, /const shouldInvalidateSession\s*=\s*sessionIdentityChanged \|\| passwordChanged/);
  assert.match(service, /if \(shouldInvalidateSession\)\s*\{\s*await revokeStaffSessionVersion/);
  assert.match(service, /updatedAccount && shouldInvalidateSession/);
  assert.match(controller, /reason: passwordResetRequested[\s\S]{0,120}'admin-password-reset'/);
  assert.match(controller, /code: passwordResetRequested[\s\S]{0,120}'PASSWORD_CHANGED'/);
});


test('self-managed password edits also revoke existing sessions', () => {
  const service = read('backend/services/accountService.js');
  const controller = read('backend/controllers/accountController.js');

  assert.match(service, /const shouldInvalidateSession\s*=\s*sessionIdentityChanged \|\| passwordChanged/);
  assert.doesNotMatch(service, /passwordChanged && !isSelfUpdate/);
  assert.match(controller, /Changed own account password\. Active sessions were invalidated\./);
  assert.doesNotMatch(controller, /Changed own account password\. Current session retained\./);
});

test('audit UI renders security actions as readable labels', () => {
  const panel = read('frontend/src/pages/maintenance/AuditPanel.jsx');

  assert.match(panel, /function formatActionLabel/);
  assert.match(panel, /formatActionLabel\(log\.action_taken\)/);
  assert.match(panel, /text\.includes\('password'\) \|\| text\.includes\('reset'\)/);
});
