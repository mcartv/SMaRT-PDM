'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('Admin still has the endorsement monitoring route and navigation', () => {
  const app = read('frontend/src/App.jsx');
  const layout = read('frontend/src/components/layout/AdminLayout.jsx');

  assert.match(app, /endorsements/);
  assert.match(layout, /\/admin\/endorsements/);
  assert.match(layout, /Endorsements/);
});

test('endorsement tracker keeps stage-focused monitoring views', () => {
  const tracker = read('frontend/src/pages/AllEndorsementsTracker.jsx');

  assert.match(tracker, /In Progress/);
  assert.match(tracker, /SDO/);
  assert.match(tracker, /GCO|Guidance/);
  assert.match(tracker, /PD/);
  assert.match(tracker, /Completed/);
});

test('public verification keeps office standing sections', () => {
  const verification = read('frontend/src/pages/EndorsementVerification.jsx');

  assert.match(verification, /SDO Disciplinary Standing/);
  assert.match(verification, /Guidance Moral Standing|GCO Moral Standing/);
  assert.match(verification, /Program Director Scholastic Standing|PD Scholastic Standing/);
});
