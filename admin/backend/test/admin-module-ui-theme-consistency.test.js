'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('Admin modules use current theme variables and current dashboard terminology', () => {
  const payout = read('frontend/src/pages/PayoutManagement.jsx');
  const openings = read('frontend/src/pages/ScholarshipOpenings.jsx');
  const dashboard = read('frontend/src/pages/AdminDashboard.jsx');
  const announcements = read('frontend/src/pages/AnnouncementsManagement.jsx');
  const obligations = read('frontend/src/pages/ROAdmin.jsx');

  assert.match(payout, /var\(--portal-base\)/);
  assert.match(openings, /var\(--portal-base\)/);
  assert.match(obligations, /var\(--portal-base\)/);

  assert.match(dashboard, /Administrator Dashboard/);
  assert.match(dashboard, /OSFA Administrator/);
  assert.match(dashboard, /Application Flow/);
  assert.doesNotMatch(dashboard, /OSFA Workload/);

  assert.match(announcements, /Announcements/);
});

test('global staff shells no longer render the redundant welcome sentence', () => {
  const adminLayout = read('frontend/src/components/layout/AdminLayout.jsx');
  const departmentLayout = read('frontend/src/components/layout/DepartmentPortalLayout.jsx');

  assert.doesNotMatch(adminLayout, /Welcome to SMaRT-PDM\./);
  assert.doesNotMatch(departmentLayout, /Welcome to SMaRT-PDM\./);
});
