const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('staff self-service keeps name email and position editable but department admin-controlled', () => {
  const service = read('backend/services/accountService.js');
  const profileUi = read('frontend/src/components/department/DepartmentMaintenancePage.jsx');

  assert.match(service, /const firstName = safeText\(payload\.first_name\)/);
  assert.match(service, /const lastName = safeText\(payload\.last_name\)/);
  assert.match(service, /const email = safeText\(payload\.email\)\.toLowerCase\(\)/);
  assert.match(service, /const nextPosition = position \|\| currentProfile\.position \|\| ''/);
  assert.match(service, /const nextDepartment = currentProfile\.department \|\| ''/);
  assert.doesNotMatch(service, /const department = safeText\(payload\.department\)/);

  assert.match(profileUi, /onChange=\{\(e\) => handleFieldChange\('first_name', e\.target\.value\)\}/);
  assert.match(profileUi, /onChange=\{\(e\) => handleFieldChange\('last_name', e\.target\.value\)\}/);
  assert.match(profileUi, /onChange=\{\(e\) => handleFieldChange\('email', e\.target\.value\)\}/);
  assert.match(profileUi, /onChange=\{\(e\) => handleFieldChange\('position', e\.target\.value\)\}/);
  assert.match(profileUi, /title="Department assignments are managed by Admin\."/);
});

test('profile-change notifications compare old and new profile values and keep the old actor identity', () => {
  const controller = read('backend/controllers/accountController.js');

  assert.match(controller, /const previousProfile = await accountService\.getCurrentStaffProfile\(actorUserId\)/);
  assert.match(controller, /buildProfileChangeMessages\(previousProfile, profile\)/);
  assert.match(controller, /const actorName = getProfileDisplayName\(beforeProfile\)/);
  assert.match(controller, /updated their name to/);
  assert.match(controller, /\['first_name', 'first name'\]/);
  assert.match(controller, /\['last_name', 'last name'\]/);
  assert.match(controller, /updated their \$\{label\} to/);
  assert.match(controller, /updated their email address\./);
  assert.doesNotMatch(controller, /profile\?\.name \|\| profile\?\.email.*updated their profile information/);
});

test('profile notification construction does not expose old or new email addresses in admin notification text', () => {
  const controller = read('backend/controllers/accountController.js');

  const emailBranch = controller.match(
    /if \(field === 'email'\) \{([\s\S]*?)\} else if \(field === 'phone_number'\)/
  );

  assert.ok(emailBranch, 'email-specific notification branch should exist');
  assert.match(emailBranch[1], /updated their email address\./);
  assert.doesNotMatch(emailBranch[1], /afterProfile\.email|beforeProfile\.email/);
});
