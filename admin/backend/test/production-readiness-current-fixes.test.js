'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('endorsement selects remain controlled and approved values are explicit', () => {
  const source = read('frontend/src/pages/EndorsementQueue.jsx');
  assert.match(source, /<Select value=\{selected\}/);
  assert.match(source, /<Select value=\{standing\}/);
  assert.doesNotMatch(source, /selected \|\| undefined|standing \|\| undefined/);
  assert.match(source, /value="no_offense"/);
  assert.match(source, /value="minor_offense"/);
  assert.match(source, /value="major_offense"/);
  assert.match(source, /value="good_scholastic_standing"/);
  assert.match(source, /value="average_scholastic_standing"/);
});

test('endorsement modal confirm action is visibly green', () => {
  const source = read('frontend/src/pages/EndorsementQueue.jsx');
  assert.match(source, /backgroundColor: '#059669'/);
  assert.match(source, /color: '#ffffff'/);
  assert.match(source, /borderColor: '#059669'/);
});

test('PD grade report is preview-only in endorsement queue', () => {
  const source = read('frontend/src/pages/EndorsementQueue.jsx');
  assert.match(source, /GradeReportPreview/);
  assert.match(source, /Preview Grade Report/);
  assert.doesNotMatch(source, /download=\{/);
  assert.doesNotMatch(source, /<Download/);
});

test('password verification and PD RO capability routes are aligned', () => {
  const routes = read('backend/routes/accountRoutes.js');
  const accountService = read('backend/services/accountService.js');
  const layout = read('frontend/src/components/layout/DepartmentPortalLayout.jsx');
  assert.match(routes, /router\.post\('\/me\/password\/verify'/);
  assert.match(routes, /router\.patch\('\/me\/password'/);
  assert.match(accountService, /has_ro_coordinator_access/);
  assert.match(layout, /buildApiUrl\('\/api\/accounts\/me'\)/);
  assert.doesNotMatch(layout, /ro-coordinator\/summary/);
});

test('responsive chart containers have measurable minimum dimensions', () => {
  for (const relative of [
    'frontend/src/pages/AdminDashboard.jsx',
    'frontend/src/pages/ReportGeneration.jsx',
    'frontend/src/components/ui/chart.jsx',
  ]) {
    const source = read(relative);
    assert.match(source, /min-w-0|minWidth=\{0\}/);
  }
});

test('shared Select wrapper never lets a controlled value become undefined', () => {
  const selectSource = read('frontend/src/components/ui/select.jsx');
  const accountsSource = read('frontend/src/pages/maintenance/AccountsPanel.jsx');

  assert.match(selectSource, /hasOwnProperty\.call\(props, ["']value["']\)/);
  assert.match(selectSource, /value: props\.value \?\? ["']["']/);
  assert.match(accountsSource, /<Select value=\{value \?\? ['"]['"]\}/);
  assert.doesNotMatch(accountsSource, /value=\{value \|\| undefined\}/);
});

