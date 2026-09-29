'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const controller = read('mobile/frontend/lib/core/networking/connectivity_controller.dart');
const gate = read('mobile/frontend/lib/shared/widgets/offline_gate.dart');

test('connection checking allows a sleeping hosted service one minute to wake', () => {
  assert.match(controller, /serverWakeTimeout = Duration\(minutes: 1\)/);
  assert.match(controller, /\.timeout\(serverWakeTimeout\)/);
  assert.doesNotMatch(controller, /\.timeout\(const Duration\(seconds: 5\)\)/);
  assert.match(gate, /may take up to a minute/);
});
