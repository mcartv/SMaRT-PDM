const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('account notifications use account terminology instead of staff wording', () => {
  const controller = read('backend/controllers/accountController.js');

  assert.match(controller, /type: 'Account Activity'/);
  assert.match(controller, /message: `An administrator \$\{actionLabel\.toLowerCase\(\)\} your account\.`/);
  assert.match(controller, /message: 'Your account password was changed successfully\.'/);
  assert.match(controller, /message: 'Profile photo updated successfully\.'/);
  assert.match(controller, /message: 'Profile photo removed successfully\.'/);

  assert.doesNotMatch(controller, /type: 'Staff Account'/);
  assert.doesNotMatch(controller, /adminTitle: 'Staff profile/);
  assert.doesNotMatch(controller, /message: 'Your staff/);
  assert.doesNotMatch(controller, /your staff account/);
});

test('profile notifications prefer the actual account name and use A user only as final fallback', () => {
  const controller = read('backend/controllers/accountController.js');

  assert.match(
    controller,
    /return name \|\| normalizeProfileValue\(profile\.email\) \|\| 'A user';/
  );
  assert.match(controller, /adminMessage: `\$\{getProfileDisplayName\(profile\)\} updated their profile photo\.`/);
  assert.match(controller, /adminMessage: `\$\{getProfileDisplayName\(profile\)\} removed their profile photo\.`/);
  assert.doesNotMatch(controller, /A staff member/);
});
