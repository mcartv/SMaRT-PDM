'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

test('scholar backend returns program history and previous-semester summary', () => {
  const service = read('admin/backend/services/scholarService.js');

  assert.match(service, /SMART_PDM_SCHOLAR_PROGRAM_HISTORY_V1/);
  assert.match(service, /fetchScholarProgramHistory/);
  assert.match(service, /previous_program_name/);
  assert.match(service, /previous_ro_assigned_office/);
  assert.match(service, /program_history:\s*programHistory/);
  assert.match(service, /ROW_NUMBER\(\) OVER/);
  assert.match(service, /ro_placements/);
  assert.match(service, /ro_departments/);
});

test('Admin Dashboard exposes View Student History list', () => {
  const page = read('admin/frontend/src/pages/AdminDashboard.jsx');

  assert.match(page, /SMART_PDM_DASHBOARD_STUDENT_HISTORY_V1/);
  assert.match(page, /View Student History/);
  assert.match(page, /Previous Semester/);
  assert.match(page, /RO Assigned Office/);
  assert.match(page, /\/admin\/scholars\?student=/);
});

test('Scholar View Profile exposes scholarship program history', () => {
  const page = read('admin/frontend/src/pages/ScholarMonitoring.jsx');

  assert.match(page, /SMART_PDM_SCHOLAR_PROFILE_PROGRAM_HISTORY_V1/);
  assert.match(page, /Scholarship Program History/);
  assert.match(page, /history=\{s\.program_history\}/);
  assert.match(page, /RO Assigned Office/);
  assert.match(page, /requestedStudentId/);
});
