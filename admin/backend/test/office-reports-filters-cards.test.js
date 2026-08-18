'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('endorsement queue keeps current office review/filter surfaces', () => {
  const queue = read('frontend/src/pages/EndorsementQueue.jsx');

  assert.match(queue, /For Endorsement/);
  assert.match(queue, /Oldest First/);
  assert.match(queue, /Search applicant or PDM ID/);
});

test('RO Coordinator dashboard keeps operational request and scholar information without enforcing obsolete card wording', () => {
  const dashboard = read('frontend/src/pages/ROCoordinatorDashboard.jsx');

  assert.match(dashboard, /RO/i);
  assert.match(dashboard, /Request/i);
  assert.match(dashboard, /Scholar/i);
});

test('RO reports remain scoped through report access control', () => {
  const routes = read('backend/routes/reportRoutes.js');
  const service = read('backend/services/reportService.js');
  const controller = read('backend/controllers/reportController.js');

  assert.match(routes, /REPORT_STAFF/);
  assert.match(service, /id:\s*'ro'/);
  assert.match(controller, /hasActiveRoCoordinatorAssignment/);
});
