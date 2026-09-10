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

test('1093px-wide short laptop viewports use a portal-only compact density', () => {
  const styles = read('frontend/src/index.css');

  assert.match(
    styles,
    /min-width: 1060px[\s\S]*max-width: 1120px[\s\S]*max-height: 700px/
  );
  assert.doesNotMatch(styles, /max-height: 700px\)[^{]*resolution:/);
  assert.match(styles, /html:has\(\.portal-responsive-shell\)[\s\S]*font-size: 14px/);
  assert.match(styles, /\.portal-responsive-sidebar:has\(\.portal-responsive-sidebar-copy\)[\s\S]*width: 180px !important/);
  assert.match(styles, /\.portal-responsive-sidebar:not\(:has\(\.portal-responsive-sidebar-copy\)\)[\s\S]*width: 76px !important/);
  assert.match(styles, /@container portal-content \(max-width: 860px\)/);
  assert.match(styles, /\.compact-review-workspace\s*\{\s*grid-template-columns: minmax\(0, 1fr\) !important/);
  assert.match(styles, /max-height: calc\(100dvh - 1rem\) !important;[\s\S]*overflow-y: auto/);
  assert.doesNotMatch(
    styles,
    /@media \(min-width: 1060px\)[\s\S]*\.portal-responsive-content :where\(\[class~="lg:flex-row"\]\)/
  );
});
