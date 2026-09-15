'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('Admin has a dedicated RO scholar compliance report', () => {
  const controller = read('backend/controllers/reportController.js');
  const service = read('backend/services/reportService.js');

  assert.match(controller, /'ro_compliance'/);
  assert.match(service, /RO Scholar Compliance Report/);
  assert.match(service, /'Finished'/);
  assert.match(service, /'Not Fully Complied'/);
  assert.match(service, /validated_minutes/);
  assert.match(service, /remaining_hours/);
  assert.match(service, /personnel_in_charge/);
});

test('RO compliance reporting supports the requested demographic and placement filters', () => {
  const controller = read('backend/controllers/reportController.js');
  const service = read('backend/services/reportService.js');
  const page = read('frontend/src/pages/ReportGeneration.jsx');

  for (const field of ['courseId', 'yearLevel', 'gender', 'roAreaId']) {
    assert.match(controller, new RegExp(field));
    assert.match(service, new RegExp(field));
    assert.match(page, new RegExp(field));
  }

  assert.match(page, /Compliance Status/);
  assert.match(page, /Not fully complied/i);
  assert.match(page, /Pending validations/i);
});

test('shared scholar filters and aligned date range are available across reports', () => {
  const service = read('backend/services/reportService.js');
  const page = read('frontend/src/pages/ReportGeneration.jsx');

  assert.match(service, /function appendScholarDetailFilters/);
  assert.match(service, /appendDateRange\(where, params, 'a\.submission_date'/);
  assert.match(service, /appendDateRange\(where, params, 'st\.date_awarded'/);
  assert.match(service, /appendDateRange\(where, params, 'pb\.payout_date'/);
  assert.match(service, /LEFT JOIN benefactors b ON sp\.benefactor_id = b\.benefactor_id/);

  assert.match(page, /supportsStudentDetailFilters = selected !== 'slot_utilization'/);
  assert.match(page, /supportsRoAreaFilter = \['ro', 'ro_compliance'\]/);
  assert.match(page, /md:col-span-2 md:grid-cols-2/);
  assert.match(page, /Date From/);
  assert.match(page, /Date To/);
});
