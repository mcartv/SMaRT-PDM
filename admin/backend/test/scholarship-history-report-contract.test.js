'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

test('report service exposes scholarship program history report', () => {
  const service = read('admin/backend/services/reportService.js');

  assert.match(service, /SMART_PDM_SCHOLARSHIP_HISTORY_REPORT_V1/);
  assert.match(service, /id: 'scholarship_history'/);
  assert.match(service, /getScholarshipHistoryRows/);
  assert.match(service, /academicYearFromId/);
  assert.match(service, /academicYearToId/);
  assert.match(service, /ROW_NUMBER\(\) OVER/);
  assert.match(service, /history_summary/);
  assert.match(service, /ro_placements/);
  assert.match(service, /ro_departments/);
});

test('scholarship history report is Admin-accessible', () => {
  const controller = read('admin/backend/controllers/reportController.js');

  assert.match(controller, /'scholarship_history'/);
  assert.match(controller, /academicYearFromId/);
  assert.match(controller, /academicYearToId/);
});

test('reports UI exposes academic-year range and View Table workflow', () => {
  const page = read('admin/frontend/src/pages/ReportGeneration.jsx');

  assert.match(page, /scholarship_history/);
  assert.match(page, /Academic Year From/);
  assert.match(page, /Academic Year To/);
  assert.match(page, /View Table/);
  assert.match(page, /Student Scholarship History Table/);
  assert.match(page, /history_summary/);
});
