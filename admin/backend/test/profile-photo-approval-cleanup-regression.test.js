'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('profile-photo review keeps the current review and decision workspace', () => {
  const page = read('frontend/src/pages/ProfilePhotoQueue.jsx');

  assert.match(page, /Profile Photo/i);
  assert.match(page, /Review/i);
  assert.match(page, /Approve|Approved/i);
  assert.match(page, /Reject|Rejected/i);
});

test('profile-photo rejection still carries a reason/remarks path', () => {
  const page = read('frontend/src/pages/ProfilePhotoQueue.jsx');

  assert.match(page, /reason|remarks|comment/i);
});
