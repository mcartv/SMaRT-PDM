'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

const panel = read('frontend/src/components/payout/PayoutProofReviewPanel.jsx');

test('payout proof must be opened before verification is enabled', () => {
  assert.match(panel, /function proofReviewKey/);
  assert.match(panel, /hasOpenedSelectedProof/);
  assert.match(panel, /nextStatus === 'Verified' && !hasOpenedSelectedProof/);
  assert.match(panel, /disabled=\{saving \|\| !hasOpenedSelectedProof\}/);
  assert.match(panel, /Open Submitted File/);
});

test('payout proof review remains usable as a mobile bottom sheet', () => {
  assert.match(panel, /items-end[\s\S]{0,100}sm:items-center/);
  assert.match(panel, /max-h-\[100dvh\]/);
  assert.match(panel, /overflow-y-auto/);
});
