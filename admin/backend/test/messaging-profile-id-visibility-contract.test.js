const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const messages = fs.readFileSync(
  path.join(root, 'frontend/src/pages/AdminMessages.jsx'),
  'utf8',
);

test('web Messaging profile modal does not display member IDs', () => {
  const modal = messages.match(
    /function MemberProfileModal[\s\S]*?function ConfirmActionModal/,
  )?.[0] || '';

  assert.ok(modal, 'MemberProfileModal must remain available');
  assert.doesNotMatch(modal, />ID<|member\.studentNumber/);
  assert.match(modal, />Position</);
  assert.match(modal, />Office</);
  assert.match(modal, />Role</);
  assert.match(modal, />Email</);
});
