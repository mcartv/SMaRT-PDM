const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('Dashboard keeps removed scholars out of the applicant onboarding/access path', () => {
  const dashboard = read('mobile/frontend/lib/features/dashboard/presentation/screens/dashboard_screen.dart');

  assert.match(dashboard, /bool get _scholarPrivilegeRemoved/);
  assert.match(dashboard, /if \(_scholarPrivilegeRemoved\) return false;/);
  assert.match(dashboard, /if \(_hasScholarAccess \|\| _scholarPrivilegeRemoved\) return;/);
  assert.match(dashboard, /\? 'REMOVED'/);
  assert.match(dashboard, /Your scholarship record is preserved/);
});

test('Dashboard does not turn API failures into false no-application/no-opening states', () => {
  const dashboard = read('mobile/frontend/lib/features/dashboard/presentation/screens/dashboard_screen.dart');

  assert.match(dashboard, /_statusError != null && summary == null/);
  assert.match(dashboard, /Unable to load status/);
  assert.match(dashboard, /_requirementsError != null && package == null/);
  assert.match(dashboard, /_openingsError != null && _latestOpenings\.isEmpty/);
  assert.match(dashboard, /Keep the last known valid status during a transient refresh failure/);
});

test('Latest announcement preview remains actionable', () => {
  const dashboard = read('mobile/frontend/lib/features/dashboard/presentation/screens/dashboard_screen.dart');
  const start = dashboard.indexOf('class _AnnouncementCard extends StatelessWidget');
  const end = dashboard.indexOf('class _ResponsibilityRow extends StatelessWidget', start);
  const announcementCard = dashboard.slice(start, end);

  assert.match(announcementCard, /button:\s*true/);
  assert.match(announcementCard, /InkWell\([\s\S]*onTap:\s*onTap/);
});


test('Dashboard keeps the existing scholar-access resolver injection functional', () => {
  const dashboard = read('mobile/frontend/lib/features/dashboard/presentation/screens/dashboard_screen.dart');

  assert.match(dashboard, /scholarAccessResolver:\s*scholarAccessResolver/);
  assert.match(dashboard, /final DashboardScholarAccessResolver\? scholarAccessResolver/);
  assert.match(dashboard, /resolvedScholarAccess = await resolver\(provider, widget\.sessionService\)/);
  assert.match(dashboard, /if \(widget\.scholarAccessResolver != null\) return _cachedScholarAccess/);
});

test('Removed lifecycle is returned even if the historical application is unavailable', () => {
  const application = read('mobile/backend/src/services/applicationService.js');
  const start = application.indexOf('async function getMyApplicationStatusSummary');
  const end = application.indexOf('\nasync function', start + 20);
  const summaryFlow = application.slice(start, end > start ? end : application.length);

  assert.match(summaryFlow, /const scholarPrivilegeRemoved = student\?\.scholar_is_archived === true/);
  assert.match(summaryFlow, /if \(!application\)[\s\S]*scholar_privilege_removed:\s*scholarPrivilegeRemoved/);
  assert.match(summaryFlow, /scholarship_lifecycle:\s*scholarshipLifecycle/);
});
