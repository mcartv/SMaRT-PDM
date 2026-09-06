'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

const page = read('frontend/src/pages/RenewalDocumentVerification.jsx');

test('current renewal UI reviews the selected document with shared policy reasons', () => {
  assert.match(page, /activeDoc/);
  assert.match(page, /MINOR_REUPLOAD_OPTIONS/);
  assert.match(page, /MAJOR_REJECTION_OPTIONS/);
  assert.match(page, /selectedReviewReason/);
});

test('current renewal UI derives final actions directly from review state', () => {
  assert.match(page, /if \(reviewIssueMode === 'reupload'\)/);
  assert.match(page, /if \(reviewIssueMode === 'reject'\)/);
  assert.match(page, /if \(hasReupload\)/);
  assert.match(page, /if \(allVerified\)/);
});

test('renewal document preview remains explicitly constrained by the current responsive implementation', () => {
  assert.match(page, /max-h|max-w|object-contain|iframe/i);
});

test('renewal review uses laptop and wide-screen layouts with a mobile-safe action modal', () => {
  assert.match(page, /lg:grid-cols-\[minmax\(260px,320px\)_minmax\(0,1fr\)\]/);
  assert.match(page, /2xl:grid-cols-\[300px_minmax\(440px,1fr\)_380px\]/);
  assert.match(page, /lg:col-span-2 2xl:col-span-1/);
  assert.match(page, /items-end[\s\S]{0,100}sm:items-center/);
  assert.doesNotMatch(page, /window\.(alert|confirm)/);
});

test('finalized renewals are clearly read-only and hide active decision controls', () => {
  assert.match(page, /const isFinalized = \['approved', 'rejected'\]/);
  assert.match(page, /const isReadOnly = isHistorical \|\| isFinalized/);
  assert.match(page, /Review actions are unavailable because this renewal is read-only/);
  assert.match(page, /No further action is required on this renewal/);
});
