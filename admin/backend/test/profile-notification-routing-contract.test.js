const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function functionBlock(source, name, nextMarker) {
  const start = source.indexOf(`async function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const end = nextMarker ? source.indexOf(nextMarker, start + 1) : source.length;
  assert.notEqual(end, -1, `${nextMarker} should exist after ${name}`);
  return source.slice(start, end);
}

test('self-service profile updates notify admin only and rely on UI success feedback for the user', () => {
  const controller = read('backend/controllers/accountController.js');
  const profileUi = read('frontend/src/components/department/DepartmentMaintenancePage.jsx');
  const block = functionBlock(controller, 'notifyOwnAccountActivity', 'async function notifyAdminManagedAccountChange');

  assert.match(block, /createStaffNotifications\(\{/);
  assert.match(block, /roles: \['admin'\]/);
  assert.doesNotMatch(block, /createUserNotification\(\{/);
  assert.match(block, /excludeUserIds: \[actorUserId\]/);

  assert.match(profileUi, /account updated successfully\./);
  assert.match(profileUi, /profile photo updated successfully\./);
  assert.match(profileUi, /profile photo removed successfully\./);
});

test('admin update archive and restore notify both the affected account and the acting admin only', () => {
  const controller = read('backend/controllers/accountController.js');
  const block = functionBlock(controller, 'notifyAdminManagedAccountChange', 'exports.getStaffAccounts');

  assert.match(block, /userId: targetUserId/);
  assert.match(block, /message: `An administrator \$\{actionLabel\.toLowerCase\(\)\} your account\.`/);
  assert.match(block, /\['Updated', 'Archived', 'Restored'\]\.includes\(actionLabel\)/);
  assert.match(block, /userId: actorUserId/);
  assert.match(block, /const accountName = getProfileDisplayName\(account\)/);
  assert.match(block, /message: `\$\{accountName\}'s account was \$\{actionLabel\.toLowerCase\(\)\}\.`/);
  assert.doesNotMatch(block, /createStaffNotifications/);
});

test('password change remains a direct security notification to the account owner', () => {
  const controller = read('backend/controllers/accountController.js');

  assert.match(controller, /type: 'Security'/);
  assert.match(controller, /title: 'Password Changed'/);
  assert.match(controller, /message: 'Your account password was changed successfully\.'/);
});
