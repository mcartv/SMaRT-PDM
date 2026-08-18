'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('SDO conditionally exposes RO Requests when the account has RO coordinator capability', () => {
  const sdo = read('frontend/src/components/layout/SDOLayout.jsx');

  assert.match(sdo, /hasRoCoordinatorAccess/);
  assert.match(sdo, /has_ro_coordinator_access/);
  assert.match(sdo, /path:\s*'\/sdo\/ro-requests'/);
  assert.match(sdo, /label:\s*'RO Requests'/);
});

test('shared department shell still supports scoped RO request navigation for layouts that use it', () => {
  const department = read('frontend/src/components/layout/DepartmentPortalLayout.jsx');

  assert.match(department, /roQueuePath|RO Requests/);
});
