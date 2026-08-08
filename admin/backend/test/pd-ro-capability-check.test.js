'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const layout = fs.readFileSync(
  path.join(__dirname, '../../frontend/src/components/layout/DepartmentPortalLayout.jsx'),
  'utf8'
);
const accountService = fs.readFileSync(
  path.join(__dirname, '../services/accountService.js'),
  'utf8'
);

test('department layouts check RO capability through accounts/me instead of RO summary', () => {
  assert.match(layout, /\/api\/accounts\/me/);
  assert.doesNotMatch(layout, /\/api\/ro-coordinator\/summary/);
  assert.match(layout, /has_ro_coordinator_access === true/);
});

test('account profile exposes active RO coordinator capability for PD, SDO, Guidance, and dedicated coordinators', () => {
  assert.match(accountService, /hasActiveRoCoordinatorAssignment/);
  assert.match(accountService, /\['pd', 'sdo', 'guidance', 'ro_coordinator'\]\.includes\(account\.role\)/);
  assert.match(accountService, /has_ro_coordinator_access: hasRoCoordinatorAccess/);
  assert.match(accountService, /rac\.is_active = true/);
  assert.match(accountService, /rd\.is_active = true/);
});
