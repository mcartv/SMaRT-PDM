'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('Maintenance current top-level naming matches the live system', () => {
  const maintenance = read('frontend/src/pages/maintenance/Maintenance.jsx');
  const general = read('frontend/src/pages/maintenance/GeneralPanel.jsx');

  assert.match(maintenance, /Scholarship Programs/);
  assert.match(maintenance, /System Logs/);
  assert.match(general, /key:\s*'system',\s*label:\s*'System'/);

  assert.doesNotMatch(general, /System & OCR/);
});

test('Maintenance navigation remains compact and horizontally scrollable', () => {
  const maintenance = read('frontend/src/pages/maintenance/Maintenance.jsx');

  assert.match(maintenance, /overflow-x-auto/);
  assert.match(maintenance, /inline-flex/);
  assert.match(maintenance, /min-w-max/);
});
