'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('Maintenance uses responsive current sizing rather than old fixed pixel contracts', () => {
  const maintenance = read('frontend/src/pages/maintenance/Maintenance.jsx');

  assert.match(maintenance, /overflow-x-auto/);
  assert.match(maintenance, /shrink-0/);
  assert.match(maintenance, /w-max min-w-max/);
});

test('Maintenance active theme controls use the portal theme token', () => {
  const maintenance = read('frontend/src/pages/maintenance/Maintenance.jsx');

  assert.match(maintenance, /var\(--portal-base\)/);
});
