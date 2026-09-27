const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const dashboardPath = path.join(
  mobileRoot,
  'frontend',
  'lib',
  'features',
  'dashboard',
  'presentation',
  'screens',
  'dashboard_screen.dart'
);
const dashboard = fs.readFileSync(dashboardPath, 'utf8');

function sectionBetween(start, end) {
  const startIndex = dashboard.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing section start: ${start}`);
  const endIndex = dashboard.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing section end: ${end}`);
  return dashboard.slice(startIndex, endIndex);
}

test('dashboard phase 1 marker is present', () => {
  assert.match(dashboard, /SMART-PDM_MOBILE_DASHBOARD_POLISH_PHASE1_V1/);
});

test('dashboard hero keeps branded visuals but responds to compact widths', () => {
  const hero = sectionBetween('Widget _buildHero()', 'Widget _buildAnnouncements');
  assert.match(hero, /LayoutBuilder/);
  assert.match(hero, /constraints\.maxWidth < 360/);
  assert.match(hero, /constraints\.maxWidth >= 360 && textScale <= 1\.15/);
  assert.match(hero, /LinearGradient/);
  assert.match(hero, /Color\(0xFFFFFCF6\)/);
  assert.match(hero, /Color\(0xFFF6E8C8\)/);
});

test('dashboard overview is placed before announcements', () => {
  const buildStart = dashboard.indexOf(
    'final provider = context.watch<NotificationProvider>();'
  );
  assert.notEqual(buildStart, -1);
  const build = dashboard.slice(buildStart, dashboard.indexOf('  @override\n  void dispose()', buildStart));
  const overviewIndex = build.indexOf('_buildBentoDashboard()');
  const announcementsIndex = build.indexOf('_buildAnnouncements(announcements)');
  assert.ok(overviewIndex >= 0, 'overview is missing');
  assert.ok(announcementsIndex >= 0, 'announcements are missing');
  assert.ok(
    overviewIndex < announcementsIndex,
    'application/scholar overview must appear before announcements'
  );
  assert.match(build, /Application Overview/);
  assert.match(build, /Scholar Overview/);
  assert.match(build, /Start Your Scholarship Journey/);
});

test('compact phones no longer force narrow two-column bento cards', () => {
  assert.match(dashboard, /constraints\.maxWidth >= 390 && textScale <= 1\.08/);
  assert.doesNotMatch(dashboard, /constraints\.maxWidth >= 345 && textScale <= 1\.12/);
});

test('action-needed bento cards can receive stronger emphasis', () => {
  assert.match(dashboard, /bool emphasized = false/);
  assert.match(dashboard, /emphasized: nextStep\?\.isNotEmpty == true/);
  assert.match(dashboard, /emphasized: true/);
  assert.match(dashboard, /Color\(0xFFFFFAE9\)/);
});

test('bento values and details are not forcibly ellipsized', () => {
  const tile = sectionBetween(
    'class _DashboardBentoTile extends StatelessWidget',
    'class _FirstTimeGuideDialog extends StatefulWidget'
  );
  assert.doesNotMatch(tile, /TextOverflow\.ellipsis/);
  assert.match(tile, /softWrap: true/);
});

test('core dashboard destinations remain wired', () => {
  assert.match(dashboard, /AppRoutes\.scholarshipOpenings/);
  assert.match(dashboard, /AppRoutes\.status/);
  assert.match(dashboard, /AppRoutes\.documents/);
  assert.match(dashboard, /AppRoutes\.roAssignment/);
});

test('app bar title can scale down instead of overflowing compact widths', () => {
  const top = dashboard.slice(0, dashboard.indexOf('typedef DashboardScholarAccessResolver'));
  assert.match(top, /Flexible\(/);
  assert.match(top, /FittedBox\(/);
  assert.match(top, /BoxFit\.scaleDown/);
  assert.match(top, /SMaRT-PDM/);
});
