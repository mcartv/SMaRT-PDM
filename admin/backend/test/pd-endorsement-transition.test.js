'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ui = fs.readFileSync(
  path.join(__dirname, '../../frontend/src/pages/EndorsementQueue.jsx'),
  'utf8'
);

test('PD retries legacy approve only when deployed backend rejects canonical standing', () => {
  assert.match(ui, /function legacyPdPayload/);
  assert.match(ui, /action:\s*'approve'/);
  assert.match(ui, /good_scholastic_standing/);
  assert.match(ui, /average_scholastic_standing/);
  assert.match(ui, /queueKey === 'pd'/);
});

test('PD confirmation modal confirm button is visibly green', () => {
  assert.match(ui, /backgroundColor: '#059669'/);
  assert.match(ui, /color: '#ffffff'/);
  assert.match(ui, /borderColor: '#059669'/);
});

test('PD grade report remains preview-only', () => {
  assert.match(ui, /Preview Grade Report/);
  assert.doesNotMatch(ui, /download=\{/);
  assert.doesNotMatch(ui, /<Download/);
});
