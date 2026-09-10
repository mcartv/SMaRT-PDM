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

test('endorsement monitoring keeps compact cards fitted across laptop widths', () => {
  const tracker = read('frontend/src/pages/AllEndorsementsTracker.jsx');
  const progressTracker = read('frontend/src/components/endorsement/EndorsementProgressTracker.jsx');

  assert.match(tracker, /lg:grid-cols-\[repeat\(5,minmax\(0,1fr\)\)\]/);
  assert.doesNotMatch(tracker, /col-span-full/);
  assert.match(tracker, /grid grid-cols-1 gap-2\.5 xl:grid-cols-2/);
  assert.match(progressTracker, /grid-cols-\[repeat\(3,minmax\(0,1fr\)\)\]/);
  assert.doesNotMatch(progressTracker, /className="grid grid-cols-3 gap-2"/);
});

test('public verification keeps office standing sections', () => {
  const verification = read('frontend/src/pages/EndorsementVerification.jsx');

  assert.match(verification, /SDO Disciplinary Standing/);
  assert.match(verification, /Guidance Moral Standing|GCO Moral Standing/);
  assert.match(verification, /Program Director Scholastic Standing|PD Scholastic Standing/);
});
