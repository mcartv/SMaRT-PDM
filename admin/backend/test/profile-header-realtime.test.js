'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('profile saves publish an immediate same-tab profile update event', () => {
  const maintenance = read('frontend/src/components/department/DepartmentMaintenancePage.jsx');

  assert.match(maintenance, /const PORTAL_PROFILE_UPDATED_EVENT = 'portal-profile:updated'/);
  assert.match(maintenance, /window\.dispatchEvent\(new CustomEvent\(PORTAL_PROFILE_UPDATED_EVENT/);
  assert.match(maintenance, /publishPortalProfile\(profileStorageKey, mergedProfile\)/);
  assert.match(maintenance, /onProfileUpdated\?\.\(mergedProfile\)/);
});

test('admin and department headers subscribe to immediate profile updates', () => {
  const adminLayout = read('frontend/src/components/layout/AdminLayout.jsx');
  const departmentLayout = read('frontend/src/components/layout/DepartmentPortalLayout.jsx');
  const sdoLayout = read('frontend/src/components/layout/SDOLayout.jsx');

  assert.match(adminLayout, /window\.addEventListener\('portal-profile:updated', handleProfileUpdated\)/);
  assert.match(adminLayout, /event\.detail\?\.profileStorageKey !== 'adminProfile'/);

  assert.match(departmentLayout, /window\.addEventListener\('portal-profile:updated', handleProfileUpdated\)/);
  assert.match(departmentLayout, /event\.detail\?\.profileStorageKey !== profileStorageKey/);

  assert.match(sdoLayout, /<DepartmentPortalLayout/);
  assert.match(sdoLayout, /profileStorageKey="sdoProfile"/);
});

test('current report authorization is role-group based and does not contain legacy Admin-only error', () => {
  const routes = read('backend/routes/reportRoutes.js');
  const rbac = read('backend/middleware/rbacMiddleware.js');
  const controller = read('backend/controllers/reportController.js');

  assert.match(routes, /authorizeRoleGroup\('REPORT_STAFF'\)/);
  assert.match(rbac, /REPORT_STAFF: Object\.freeze\(\['admin', 'sdo', 'guidance', 'pd', 'ro_coordinator'\]\)/);
  assert.doesNotMatch(`${routes}\n${rbac}\n${controller}`, /Admin access required/i);
});
