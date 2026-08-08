'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ui = fs.readFileSync(
  path.join(__dirname, '../../frontend/src/pages/EndorsementQueue.jsx'),
  'utf8'
);

test('SDO queue sends one deployed-backend-compatible action payload', () => {
  assert.match(ui, /function legacySdoPayload\(action, remarks\)/);
  assert.match(ui, /no_offense:\s*'clear'/);
  assert.match(ui, /minor_offense:\s*'disqualify_minor'/);
  assert.match(ui, /major_offense:\s*'disqualify_major'/);
  assert.match(ui, /offense_type:/);
});

test('Guidance sends the deployed-backend-compatible clear action directly', () => {
  assert.match(ui, /function legacyGuidancePayload\(action, remarks\)/);
  assert.match(ui, /action:\s*'clear'/);
  assert.match(ui, /action !== 'good_moral_standing'/);
  assert.doesNotMatch(ui, /guidance \(\?:action\|result\)/);
});

test('confirmation modal confirm button is explicitly green', () => {
  assert.match(ui, /function confirmationButtonClass\(\)/);
  assert.match(ui, /bg-emerald-600 text-white hover:bg-emerald-700/);
  assert.match(
    ui,
    /className=\{`\$\{confirmationButtonClass\(\)\} min-w-24 border-emerald-600 font-semibold shadow-sm`\}/
  );
  assert.match(
    ui,
    /style=\{\{ backgroundColor: '#059669', color: '#ffffff', borderColor: '#059669' \}\}/
  );
});
