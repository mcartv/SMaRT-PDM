const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const dashboard = fs.readFileSync(
  path.join(
    mobileRoot,
    'frontend',
    'lib',
    'features',
    'dashboard',
    'presentation',
    'screens',
    'dashboard_screen.dart'
  ),
  'utf8'
);

function sectionBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing section start: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('Scholar Updates rows open their matching top-level scholar modules', () => {
  assert.match(dashboard, /app\/routes\/app_navigator\.dart/);
  const section = sectionBetween(
    dashboard,
    'Widget _buildScholarResponsibilities',
    'SMART-PDM_MOBILE_DASHBOARD_POLISH_PHASE1_V1'
  );

  assert.match(
    section,
    /title: 'Renewal'[\s\S]*AppNavigator\.goToTopLevel\(context, AppRoutes\.renewalDocuments\)/
  );
  assert.match(
    section,
    /title: 'Return of Obligation'[\s\S]*AppNavigator\.goToTopLevel\(context, AppRoutes\.roAssignment\)/
  );
  assert.match(
    section,
    /title: 'Payout'[\s\S]*AppNavigator\.goToTopLevel\(context, AppRoutes\.payouts\)/
  );
  assert.doesNotMatch(section, /Navigator\.pushNamed\(context, AppRoutes\.roAssignment\)/);
});

test('Scholar Dashboard keeps useful scholar updates without a redundant overview card', () => {
  assert.doesNotMatch(dashboard, /Scholar Overview|Scholarship Overview/);
  assert.match(dashboard, /Your latest renewal, obligation, and payout updates\./);
  assert.match(dashboard, /showOverview = !_hasScholarAccess \|\| _scholarPrivilegeRemoved/);
  assert.doesNotMatch(dashboard, /Use the bottom navigation for payout, obligation, and renewal actions\./);
});
