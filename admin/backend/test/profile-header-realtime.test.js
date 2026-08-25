'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('current staff layouts subscribe to profile updates directly or through the shared department shell', () => {
  const sdo = read('frontend/src/components/layout/SDOLayout.jsx');
  const department = read('frontend/src/components/layout/DepartmentPortalLayout.jsx');

  assert.match(sdo, /profile:updated/);
  assert.match(sdo, /portal-profile:updated/);
  assert.match(department, /profile:updated|portal-profile:updated/);
});

test('SDO profile header resolves stored profile photos and identity', () => {
  const sdo = read('frontend/src/components/layout/SDOLayout.jsx');

  assert.match(sdo, /resolveProfileImage/);
  assert.match(sdo, /sdoProfile/);
  assert.match(sdo, /getDisplayName/);
});
