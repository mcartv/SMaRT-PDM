'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('maintenance panels use the current portal theme rather than a hard-coded brown', () => {
  const source = [
    'frontend/src/pages/maintenance/AccountsPanel.jsx',
    'frontend/src/pages/maintenance/ScholarshipProgramsPanel.jsx',
    'frontend/src/pages/maintenance/CoursesPanel.jsx',
    'frontend/src/pages/maintenance/ROSettingsPanel.jsx',
    'frontend/src/pages/maintenance/GeneralPanel.jsx',
    'frontend/src/pages/maintenance/StudentRegistryPanel.jsx',
    'frontend/src/pages/maintenance/AcademicYearPanel.jsx',
  ].map(read).join('\n');

  assert.match(source, /var\(--portal-base\)/);
  assert.doesNotMatch(source, /brownMid:\s*'#7c4a2e'/);
});

test('Payout keeps current section controls and theme-aware primary actions', () => {
  const source = read('frontend/src/pages/PayoutManagement.jsx');

  assert.match(source, /activeSection/);
  assert.match(source, /Active Payout Batches/);
  assert.match(source, /Completed Payouts/);
  assert.match(source, /Archived Payout Batches/);
  assert.match(source, /brownMid:\s*'var\(--portal-base\)'/);
});

test('General maintenance uses System rather than System & OCR', () => {
  const source = read('frontend/src/pages/maintenance/GeneralPanel.jsx');

  assert.match(source, /key:\s*'system',\s*label:\s*'System'/);
  assert.doesNotMatch(source, /System & OCR/);
});
