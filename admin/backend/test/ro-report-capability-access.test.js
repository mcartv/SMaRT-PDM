'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('report RBAC includes dedicated RO Coordinator accounts', () => {
  const policy = read('backend/middleware/rbacMiddleware.js');
  const routes = read('backend/routes/reportRoutes.js');

  assert.match(policy, /REPORT_STAFF: Object\.freeze\(\['admin', 'sdo', 'guidance', 'pd', 'ro_coordinator'\]\)/);
  assert.match(routes, /authorizeRoleGroup\('REPORT_STAFF'\)/);
});

test('PD, SDO, and Guidance can receive RO reports only through active assignment capability', () => {
  const controller = read('backend/controllers/reportController.js');
  const accounts = read('backend/services/accountService.js');
  const app = read('frontend/src/App.jsx');

  assert.match(accounts, /hasActiveRoCoordinatorAssignment,/);
  assert.match(controller, /await accountService\.hasActiveRoCoordinatorAssignment\(userId\)/);
  assert.match(controller, /if \(hasRoCoordinatorAccess\) \{\s*allowed\.push\('ro'\);/s);
  assert.match(controller, /roUserId: reportType === 'ro' \? access\.userId : ''/);
  assert.match(app, /allowedReportTypes=\{\['pd', 'ro'\]\}/);
  assert.match(app, /allowedReportTypes=\{\['sdo', 'ro'\]\}/);
  assert.match(app, /allowedReportTypes=\{\['guidance', 'ro'\]\}/);
});

test('RO report access does not silently become Admin-only', () => {
  const routes = read('backend/routes/reportRoutes.js');
  const controller = read('backend/controllers/reportController.js');

  assert.doesNotMatch(routes, /authorizeRoles\('admin'\)/);
  assert.match(controller, /An active RO Area coordinator assignment is required/);
  assert.match(controller, /error\.statusCode = 403/);
});
