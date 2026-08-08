'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('PD, SDO, and Guidance keep their primary roles and expose RO Requests only with assignment capability', () => {
  const departmentLayout = read('frontend/src/components/layout/DepartmentPortalLayout.jsx');
  const pdLayout = read('frontend/src/components/layout/PDLayout.jsx');
  const sdoLayout = read('frontend/src/components/layout/SDOLayout.jsx');
  const guidanceLayout = read('frontend/src/components/layout/GuidanceLayout.jsx');
  const accountService = read('backend/services/accountService.js');

  assert.match(departmentLayout, /has_ro_coordinator_access === true/);
  assert.match(pdLayout, /roQueuePath="\/pd\/ro-requests"/);
  assert.match(sdoLayout, /buildApiUrl\('\/api\/accounts\/me'\)/);
  assert.match(sdoLayout, /has_ro_coordinator_access === true/);
  assert.match(sdoLayout, /path: '\/sdo\/ro-requests'/);
  assert.match(guidanceLayout, /roQueuePath="\/guidance\/ro-requests"/);
  assert.match(accountService, /\['pd', 'sdo', 'guidance', 'ro_coordinator'\]\.includes\(account\.role\)/);
});

test('SDO and Guidance RO Requests routes reuse the existing RO Coordinator workflow', () => {
  const app = read('frontend/src/App.jsx');

  assert.match(
    app,
    /path="ro-requests"[\s\S]*tokenStorageKey="guidanceToken"[\s\S]*portalKey="guidance"/
  );
  assert.match(
    app,
    /path="ro-requests"[\s\S]*tokenStorageKey="sdoToken"[\s\S]*portalKey="sdo"/
  );
});

test('existing RO Requests workflow includes coordinator scholar requests to Admin', () => {
  const queue = read('frontend/src/pages/ROCoordinatorQueue.jsx');
  const scholarRequests = read('frontend/src/pages/ROCoordinatorScholarRequests.jsx');
  const routes = read('backend/routes/roCoordinatorRoutes.js');
  const controller = read('backend/controllers/roCoordinatorController.js');

  assert.match(queue, /value: 'scholars', label: 'Scholar Requests'/);
  assert.match(queue, /<ROCoordinatorScholarRequests/);
  assert.match(queue, /tokenStorageKey=\{tokenStorageKey\}/);
  assert.match(queue, /portalKey=\{portalKey\}/);
  assert.match(scholarRequests, /Request available scholars from Admin/);
  assert.match(scholarRequests, /New Request/);
  assert.match(scholarRequests, /Send to Admin/);
  assert.match(routes, /router\.post\('\/scholar-requests', controller\.createScholarRequest\)/);
  assert.match(controller, /INSERT INTO ro_scholar_requests/);
  assert.match(controller, /Scholar request sent to Admin\./);
});

test('RO capability is enforced by an active RO Area assignment server-side', () => {
  const accountService = read('backend/services/accountService.js');
  const controller = read('backend/controllers/roCoordinatorController.js');

  assert.match(accountService, /rac\.is_active = true/);
  assert.match(accountService, /rd\.is_active = true/);
  assert.match(controller, /rac\.is_active = true/);
  assert.match(controller, /rd\.is_active = true/);
  assert.match(controller, /You do not have an active RO Area coordinator assignment\./);
});

test('Admin can assign PD, SDO, Guidance, or dedicated RO Coordinator staff, while Admin itself remains excluded', () => {
  const rbac = require('../middleware/rbacMiddleware');
  const routes = read('backend/routes/roCoordinatorRoutes.js');
  const settings = read('backend/services/roSettingService.js');

  assert.deepEqual(rbac.ROLE_GROUPS.RO_COORDINATOR_CAPABLE, ['sdo', 'guidance', 'pd', 'ro_coordinator']);
  assert.match(routes, /authorizeRoleGroup\('RO_COORDINATOR_CAPABLE'\)/);
  assert.match(settings, /RO_COORDINATOR_CAPABLE_ROLES = new Set\(\['pd', 'sdo', 'guidance', 'ro_coordinator'\]\)/);
  assert.match(settings, /\.filter\(\(row\) => isRoCoordinatorCapableStaff\(row\)\)/);
  assert.match(settings, /Only Program Director, SDO, Guidance, or RO Coordinator accounts can be assigned to an RO Area\./);
  assert.doesNotMatch(settings, /RO_COORDINATOR_CAPABLE_ROLES = new Set\([^\n]*'admin'/);
});

test('department portals route RO notifications to their RO Requests page', () => {
  const notifications = read('frontend/src/hooks/usePortalNotifications.js');

  assert.match(notifications, /'return_of_obligation'/);
  assert.match(notifications, /'ro_time_log'/);
  assert.match(notifications, /\['\/sdo', '\/guidance', '\/pd'\]\.includes\(portalRootPath\)/);
  assert.match(notifications, /return `\$\{portalRootPath\}\/ro-requests`/);
});
