'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ui = fs.readFileSync(
  path.join(__dirname, '../../frontend/src/pages/EndorsementQueue.jsx'),
  'utf8'
);

test('PD Grade Report uses an in-app preview and has no download action', () => {
  assert.match(ui, /function GradeReportPreview/);
  assert.match(ui, /<iframe/);
  assert.match(ui, /Preview Grade Report/);
  assert.doesNotMatch(ui, /download=\{/);
  assert.doesNotMatch(ui, /<Download/);
});

test('confirmation modal confirm action is forced visible green', () => {
  assert.match(ui, /backgroundColor: '#059669'/);
  assert.match(ui, /color: '#ffffff'/);
  assert.match(ui, /min-w-24 border-emerald-600 font-semibold/);
});
