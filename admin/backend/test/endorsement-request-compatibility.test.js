'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ui = fs.readFileSync(
  path.join(__dirname, '../../frontend/src/pages/EndorsementQueue.jsx'),
  'utf8'
);
const service = fs.readFileSync(
  path.join(__dirname, '../services/endorsementSlipService.js'),
  'utf8'
);

test('action selects remain controlled from the first render', () => {
  assert.match(ui, /<Select value=\{selected\}/);
  assert.match(ui, /<Select value=\{standing\}/);
  assert.doesNotMatch(ui, /selected \|\| undefined/);
  assert.doesNotMatch(ui, /standing \|\| undefined/);
});

test('frontend sends one transition-safe request instead of canonical request then 400 retry', () => {
  assert.match(ui, /requestPayload = legacySdoPayload/);
  assert.match(ui, /requestPayload = legacyGuidancePayload/);
  assert.match(ui, /requestPayload = legacyPdPayload/);
  assert.doesNotMatch(ui, /response\.status === 400/);
  assert.match(ui, /action:\s*'clear'/);
  assert.match(ui, /action:\s*'approve'/);
});

test('PD compatibility payload preserves explicitly selected scholastic standing', () => {
  assert.match(ui, /scholastic_standing:\s*action/);
  assert.match(service, /scholasticStanding:\s*payload\?\.scholastic_standing/);
});
