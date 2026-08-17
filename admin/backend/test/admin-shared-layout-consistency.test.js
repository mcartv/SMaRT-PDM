'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('Admin keeps its own layout while mirroring the department portal shell', () => {
  const admin = read('frontend/src/components/layout/AdminLayout.jsx');
  const department = read('frontend/src/components/layout/DepartmentPortalLayout.jsx');

  assert.doesNotMatch(admin, /import DepartmentPortalLayout/);
  assert.doesNotMatch(admin, /<DepartmentPortalLayout/);
  assert.match(admin, /export default function AdminLayout/);

  // Shared visual contract: same shell primitives and sizing language.
  for (const token of [
    'h-screen',
    "collapsed ? '76px'",
    '248px',
    'rounded-xl px-3 py-2.5 text-sm',
    'h-16',
    'Good Morning',
    'rounded-full border border-stone-200 bg-white py-1.5 pl-1.5 pr-2',
    'max-w-7xl',
  ]) {
    assert.match(admin, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.doesNotMatch(admin, /Welcome to SMaRT-PDM\./);
  assert.doesNotMatch(department, /Welcome to SMaRT-PDM\./);

  assert.match(department, /rounded-xl px-3 py-2\.5 text-sm/);
  assert.match(department, /rounded-full border border-stone-200 bg-white py-1\.5 pl-1\.5 pr-2/);
});

test('Admin preserves every administrator navigation module', () => {
  const layout = read('frontend/src/components/layout/AdminLayout.jsx');
  const modules = [
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
  ];

  for (const [pathPart, label] of modules) {
    assert.match(layout, new RegExp(`path: '/admin/${pathPart}'[\\s\\S]*?label: '${label}'`));
  }

  assert.match(layout, /authService\.logout/);
  assert.match(layout, /adminToken/);
  assert.match(layout, /adminProfile/);
});

test('Admin is no longer affected by legacy admin-ui text and control scaling', () => {
  const layout = read('frontend/src/components/layout/AdminLayout.jsx');
  assert.doesNotMatch(layout, /className="admin-ui/);
});

test('Admin dashboard keeps a distinct admin composition while restoring the themed gradient hero', () => {
  const dashboard = read('frontend/src/pages/AdminDashboard.jsx');

  assert.doesNotMatch(dashboard, /function StatCard/);
  assert.doesNotMatch(dashboard, /2xl:grid-cols-8/);
  assert.match(dashboard, /linear-gradient\(135deg/);
  assert.match(dashboard, /OSFA Administration/);
  assert.match(dashboard, /Administrator Dashboard/);
  assert.match(dashboard, /Scholarship operations/);
  assert.match(dashboard, /Needs Review/);
  assert.match(dashboard, /Ready for Activation/);
  assert.match(dashboard, /Waiting List/);
  assert.match(dashboard, /Open Openings/);
  assert.match(dashboard, /Benefactors/);
  assert.match(dashboard, /Action Center/);
  assert.match(dashboard, /Application Flow/);
  assert.match(dashboard, /Active Scholars by Benefactor/);
  assert.match(dashboard, /Recent Applicants/);
  assert.match(dashboard, /Open Applications/);
  assert.doesNotMatch(dashboard, /OSFA Workload/);
  assert.doesNotMatch(dashboard, /Application Lifecycle/);
  assert.doesNotMatch(dashboard, /size="sm"/);
});
