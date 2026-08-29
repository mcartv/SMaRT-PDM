'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('endorsement start notifies SDO and Admin once with concise role-specific copy', () => {
  const source = read('backend/middleware/endorsementNotificationMiddleware.js');

  assert.match(source, /roles: \['sdo'\]/);
  assert.match(source, /roles: \['admin'\]/);
  assert.match(source, /title: 'New endorsement awaiting review'/);
  assert.match(source, /title: `Endorsement started for \$\{studentName\}`/);
  assert.match(source, /createUserNotificationOnce/);
});

test('current endorsement handoffs describe reviews rather than unsupported approvals', () => {
  const source = read('backend/services/endorsementSlipService.js');

  assert.match(source, /nextTitle: 'Guidance review pending'/);
  assert.match(source, /nextTitle: 'Scholastic standing review pending'/);
  assert.match(source, /message: `\$\{studentName\} completed all endorsement reviews\.`/);
  assert.doesNotMatch(source, /nextTitle: 'PD approval pending'/);
});

test('staff bells trust per-user server targeting without message-text filtering', () => {
  const source = read('frontend/src/hooks/usePortalNotifications.js');

  assert.match(source, /const normalized = rows\.map\(normalizeNotification\)/);
  assert.doesNotMatch(source, /isRelevantPortalNotification/);
  assert.doesNotMatch(source, /descriptor\.includes/);
});

test('managed account notifications go to the affected user and not the acting Admin', () => {
  const source = read('backend/controllers/accountController.js');
  const hook = read('frontend/src/hooks/usePortalNotifications.js');

  assert.match(source, /userId: targetUserId/);
  assert.match(source, /message: `An administrator \$\{actionLabel\.toLowerCase\(\)\} your account\.`/);
  assert.doesNotMatch(source, /const actorNotification/);
  assert.match(hook, /if \(referenceType === 'staff_account'\) \{\s*return null;/);
});
