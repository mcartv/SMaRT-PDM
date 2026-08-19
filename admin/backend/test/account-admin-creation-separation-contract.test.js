'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('ordinary and Admin account creation remain separate current-system flows', () => {
  const panel = read('frontend/src/pages/maintenance/AccountsPanel.jsx');
  const routes = read('backend/routes/accountRoutes.js');
  const service = read('backend/services/accountService.js');

  assert.match(panel, /Create Account/);
  assert.match(panel, /Create Admin Account/);
  assert.match(panel, /OPERATIONAL_ROLE_OPTIONS/);

  assert.match(routes, /router\.post\('\/staff'[\s\S]*createStaffAccount/);
  assert.match(routes, /router\.post\('\/admin'[\s\S]*createAdminAccount/);

  assert.match(
    service,
    /const OPERATIONAL_ROLE_VALUES = \['pd', 'guidance', 'sdo', 'ro_coordinator'\]/
  );
  assert.match(service, /async function createAdminAccount/);
});

test('Edit Account keeps the Admin boundary enforced', () => {
  const panel = read('frontend/src/pages/maintenance/AccountsPanel.jsx');
  const service = read('backend/services/accountService.js');

  assert.match(service, /crossesAdminBoundary/);
  assert.match(
    service,
    /Admin accounts and department accounts cannot be converted into each other/
  );
  assert.match(panel, /editRoleOptions/);
});
