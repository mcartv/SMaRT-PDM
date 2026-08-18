'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('archiving/restoring staff accounts revokes the server-side staff session version', () => {
  const service = read('backend/services/accountService.js');

  assert.match(service, /archiveStaffAccount[\s\S]*revokeStaffSessionVersion/);
  assert.match(service, /restoreStaffAccount[\s\S]*revokeStaffSessionVersion/);
});

test('current self-service password change updates the password hash', () => {
  const service = read('backend/services/accountService.js');

  assert.match(service, /async function changeCurrentStaffPassword/);
  assert.match(service, /bcrypt\.hash\(validPassword,\s*12\)/);
  assert.match(service, /UPDATE users SET password_hash = \$2 WHERE user_id = \$1/);
});

test('current password-change controller forces active browser/socket sessions to sign in again', () => {
  const controller = read('backend/controllers/accountController.js');

  assert.match(controller, /exports\.changeCurrentStaffPassword = async/);
  assert.match(controller, /disconnectAccountSockets\(req,\s*actorUserId/);
  assert.match(controller, /reason:\s*'password-changed'/);
  assert.match(controller, /code:\s*'PASSWORD_CHANGED'/);
  assert.match(controller, /Please sign in again/);
});

test('client-side auth guard handles revoked/invalid sessions globally', () => {
  const authStorage = read('frontend/src/utils/authStorage.js');

  assert.match(authStorage, /SESSION_INVALIDATION_CODES/);
  assert.match(authStorage, /invalidateStoredPortalSession/);
  assert.match(authStorage, /installSessionInvalidationFetchGuard/);
});
