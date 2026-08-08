const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('department portals expose Settings instead of Maintenance', () => {
  const genericLayout = read('frontend/src/components/layout/DepartmentPortalLayout.jsx');
  const sdoLayout = read('frontend/src/components/layout/SDOLayout.jsx');
  assert.match(genericLayout, /label: 'Settings'/);
  assert.match(sdoLayout, /path: '\/sdo\/settings', label: 'Settings'/);
});

test('department settings contain Account, Theme, Security and do not expose RO assignments', () => {
  const page = read('frontend/src/components/department/DepartmentSettingsPage.jsx');
  assert.match(page, /label: 'Account'/);
  assert.match(page, /label: 'Theme'/);
  assert.match(page, /label: 'Security'/);
  assert.doesNotMatch(page, /RO Assignment|assigned_by|RO Area:/i);
  assert.doesNotMatch(page, /General Configuration|Institution Info|Review Window|Counseling Queue/i);
});

test('password change requires the current password server-side', () => {
  const service = read('backend/services/accountService.js');
  const routes = read('backend/routes/accountRoutes.js');
  assert.match(routes, /'\/me\/password'/);
  assert.match(service, /Current password is required/);
  assert.match(service, /bcrypt\.compare\(currentPassword, passwordHash\)/);
  assert.match(service, /New password must be different from the current password/);
});

test('department notification hook filters notifications by portal responsibility', () => {
  const hook = read('frontend/src/hooks/usePortalNotifications.js');
  assert.match(hook, /isRelevantPortalNotification/);
  assert.match(hook, /endorsement_slip/);
  assert.match(hook, /return_of_obligation/);
  assert.match(hook, /ro_time_log/);
  assert.match(hook, /ro-requests/);
  assert.match(hook, /portalRootPath === '\/admin'/);
});

test('landing polish is included without replacing OSFA office terminology', () => {
  const landing = read('frontend/src/pages/SmartPDMLanding.jsx');
  assert.match(landing, /How to Apply/);
  assert.match(landing, /FAQs/);
  assert.match(landing, /About SMaRT-PDM/);
  assert.match(landing, /Office for Scholarship and Financial Assistance/);
});
