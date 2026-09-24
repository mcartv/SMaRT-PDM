'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('endorsement queue keeps current office review/filter surfaces', () => {
  const queue = read('frontend/src/pages/EndorsementQueue.jsx');

  assert.match(queue, /For Endorsement/);
  assert.match(queue, /Oldest First/);
  assert.match(queue, /Search applicant or PDM ID/);
});

test('RO Personnel-In-Charge dashboard keeps operational request and scholar information without enforcing obsolete card wording', () => {
  const dashboard = read('frontend/src/pages/ROCoordinatorDashboard.jsx');

  assert.match(dashboard, /RO/i);
  assert.match(dashboard, /Request/i);
  assert.match(dashboard, /Scholar/i);
});

test('RO reports remain scoped through report access control', () => {
  const routes = read('backend/routes/reportRoutes.js');
  const service = read('backend/services/reportService.js');
  const controller = read('backend/controllers/reportController.js');

  assert.match(routes, /REPORT_STAFF/);
  assert.match(service, /id:\s*'ro'/);
  assert.match(controller, /hasActiveRoCoordinatorAssignment/);
});

test('department report selection includes SDO offense classifications and optional RO responsibility', () => {
  const page = read('frontend/src/pages/ReportGeneration.jsx');
  const app = read('frontend/src/App.jsx');
  const service = read('backend/services/reportService.js');
  const controller = read('backend/controllers/reportController.js');

  assert.match(page, /groupedReportTypes\.map\(\(group\)/);
  assert.match(page, /<TemplateRow/);
  assert.match(page, /sdo_offenses:[\s\S]*no_offense[\s\S]*minor_offense[\s\S]*major_offense/);
  assert.match(app, /allowedReportTypes=\{\['sdo', 'sdo_offenses', 'ro'\]\}/);
  assert.match(service, /name:\s*'SDO Offense Classification Report'/);
  assert.match(service, /offense_classification:\s*normalizeSdoOffenseClassification/);
  const offenseRowMapper = service.match(/async function getSdoOffenseRows[\s\S]*?\n}/)?.[0] || '';
  const offenseExport = service.match(/normalized\.reportType === 'sdo_offenses'[\s\S]*?} else if \(normalized\.reportType === 'guidance'\)/)?.[0] || '';
  assert.doesNotMatch(offenseRowMapper, /opening_title/);
  assert.doesNotMatch(offenseExport, /key:\s*'opening_title'/);
  assert.match(controller, /normalizedRole === 'sdo'[\s\S]*allowed\.push\('sdo_offenses'\)/);
  assert.match(controller, /hasRoCoordinatorAccess[\s\S]*allowed\.push\('ro'\)/);
});

test('department reports use a responsive landscape workspace while Admin keeps its existing split layout', () => {
  const page = read('frontend/src/pages/ReportGeneration.jsx');

  assert.match(page, /const isDepartmentView = portalKey !== 'admin'/);
  assert.match(page, /isDepartmentView[\s\S]*Download Excel[\s\S]*Download CSV/);
  assert.match(page, /handlePrintPreview[\s\S]*window\.open[\s\S]*printWindow\.print/);
  assert.match(page, /<Printer[\s\S]*Print/);
  assert.match(page, /sm:grid-cols-2 xl:grid-cols-4/);
  assert.match(page, /Reset Filters/);
  assert.match(page, /xl:grid-cols-12 xl:items-start/);
  assert.match(page, /xl:col-span-4[\s\S]*xl:col-span-8/);
});
