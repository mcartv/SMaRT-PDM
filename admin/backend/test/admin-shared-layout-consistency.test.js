'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('Admin keeps its own layout and complete administrator navigation', () => {
  const layout = read('frontend/src/components/layout/AdminLayout.jsx');

  assert.match(layout, /export default function AdminLayout/);
  assert.doesNotMatch(layout, /<DepartmentPortalLayout/);

  for (const [pathPart, label] of [
    ['dashboard', 'Dashboard'],
    ['applications', 'Applications'],
    ['endorsements', 'Endorsements'],
    ['scholars', 'Scholars'],
    ['obligations', 'Obligations'],
    ['payout', 'Payout'],
    ['reports', 'Reports'],
    ['openings', 'Openings'],
    ['announcements', 'Announcements'],
    ['profile-photos', 'Profile Photos'],
    ['maintenance', 'Maintenance'],
  ]) {
    assert.match(layout, new RegExp(`/admin/${pathPart}`));
    assert.match(layout, new RegExp(label));
  }
});

test('Admin dashboard reflects current OSFA Administrator naming', () => {
  const dashboard = read('frontend/src/pages/AdminDashboard.jsx');

  assert.match(dashboard, /OSFA Administrator/);
  assert.match(dashboard, /Administrator Dashboard/);
  assert.match(dashboard, /Scholarship operations/);
});
