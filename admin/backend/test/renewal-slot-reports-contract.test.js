'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('Admin alone receives renewal and slot utilization report templates', () => {
  const controller = read('backend/controllers/reportController.js');
  const service = read('backend/services/reportService.js');

  assert.match(controller, /if \(normalizedRole === 'admin'\)[\s\S]*'renewals'/);
  assert.match(controller, /if \(normalizedRole === 'admin'\)[\s\S]*'slot_utilization'/);
  assert.match(service, /Scholarship Renewal Report/);
  assert.match(service, /Scholarship Slot Report/);
});

test('renewal report uses decided renewal records and real workflow statuses', () => {
  const service = read('backend/services/reportService.js');

  assert.match(service, /r\.status IN \('Approved', 'Rejected'\)/);
  assert.match(service, /WHEN r\.status = 'Approved' THEN 'Renewed'/);
  assert.match(service, /WHEN r\.status = 'Rejected' THEN 'Did Not Renew'/);
  assert.match(service, /r\.reviewed_at AS renewal_date/);
  assert.match(service, /COALESCE\(r\.decision_reason, r\.flagged_reason\) AS remarks/);
  assert.doesNotMatch(service, /renewal eligibility report/i);
});

test('slot report derives current occupancy and released slots from scholar lifecycle rows', () => {
  const service = read('backend/services/reportService.js');

  assert.match(service, /LOWER\(COALESCE\(st_active\.scholarship_status, ''\)\) = 'active'/);
  assert.match(service, /COALESCE\(st_active\.scholar_is_archived, FALSE\) = FALSE/);
  assert.match(service, /LOWER\(COALESCE\(st_removed\.scholarship_status, ''\)\) = 'removed'/);
  assert.match(service, /COUNT\(DISTINCT st_removed\.student_id\)/);
  assert.match(service, /LEAST\(counts\.available_slots, counts\.removed_scholars\)/);
  assert.doesNotMatch(service, /utilization_percentage/);
});

test('new reports share preview, Excel, CSV, reset, and requested filter UI', () => {
  const service = read('backend/services/reportService.js');
  const page = read('frontend/src/pages/ReportGeneration.jsx');

  assert.match(service, /scholarship_renewal_report\.xlsx/);
  assert.match(service, /scholarship_slot_report\.xlsx/);
  assert.match(page, /All Renewal Outcomes/);
  assert.match(page, /All Opening Statuses/);
  assert.match(page, /Renewal Status/);
  assert.match(page, /Opening Status/);
  assert.match(page, /handlePreviewReport/);
  assert.match(page, /handleDownloadByFormat\('csv'\)/);
  assert.match(page, /resetFilters/);
});
