'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('SDO keeps Settings and conditionally exposes RO Requests in its current direct layout', () => {
  const sdo = read('frontend/src/components/layout/SDOLayout.jsx');

  assert.match(sdo, /\/sdo\/settings/);
  assert.match(sdo, /hasRoCoordinatorAccess/);
  assert.match(sdo, /\/sdo\/ro-requests/);
  assert.match(sdo, /RO Requests/);
});

test('department shell still supports a maintenance path for layouts that use the shared shell', () => {
  const department = read('frontend/src/components/layout/DepartmentPortalLayout.jsx');

  assert.match(department, /maintenancePath/);
});
