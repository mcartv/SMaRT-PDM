const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('office endorsement summary cards use the approved role-specific labels', () => {
  const queue = read('frontend/src/pages/EndorsementQueue.jsx');
  for (const label of [
    'For Endorsement',
    'Minor Offenses',
    'Major Offenses',
    'Endorsed Today',
    'Completed Endorsements',
    'Good Scholastic Standing',
    'Average Scholastic Standing',
  ]) {
    assert.match(queue, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('endorsement filters are compact and oldest-first remains the default', () => {
  const queue = read('frontend/src/pages/EndorsementQueue.jsx');
  assert.match(queue, /useState\('oldest'\)/);
  assert.match(queue, /Oldest First/);
  assert.match(queue, /All Statuses/);
  assert.match(queue, /All Scholarships/);
  assert.match(queue, /All Courses/);
  assert.match(queue, /All Years/);
  assert.match(queue, /Search applicant or PDM ID/);
  assert.match(queue, /Reset filters/);
});

test('RO Coordinator dashboard uses the approved operational cards', () => {
  const dashboard = read('frontend/src/pages/ROCoordinatorDashboard.jsx');
  assert.match(dashboard, /Pending Validation/);
  assert.match(dashboard, /Pending RO Requests/);
  assert.match(dashboard, /Assigned Scholars/);
  assert.doesNotMatch(dashboard, /label="Approved Today"/);
  assert.doesNotMatch(dashboard, /label="Returned Today"/);
});

test('RO Coordinator has a scoped Reports route and report type', () => {
  const app = read('frontend/src/App.jsx');
  const layout = read('frontend/src/components/layout/ROCoordinatorLayout.jsx');
  const routes = read('backend/routes/reportRoutes.js');
  const service = read('backend/services/reportService.js');
  const controller = read('backend/controllers/reportController.js');

  assert.match(app, /allowedReportTypes=\{\['ro'\]\}/);
  assert.match(app, /allowedReportTypes=\{\['pd', 'ro'\]\}/);
  assert.match(app, /allowedReportTypes=\{\['guidance', 'ro'\]\}/);
  assert.match(app, /allowedReportTypes=\{\['sdo', 'ro'\]\}/);
  assert.match(layout, /reportsPath="\/ro-coordinator\/reports"/);
  assert.match(routes, /authorizeRoleGroup\('REPORT_STAFF'\)/);
  assert.match(service, /id: 'ro'/);
  assert.match(service, /rac\.user_id = \$1/);
  assert.match(controller, /hasActiveRoCoordinatorAssignment/);
  assert.match(controller, /allowed\.push\('ro'\)/);
  assert.match(controller, /roUserId: reportType === 'ro' \? access\.userId : ''/);
});
