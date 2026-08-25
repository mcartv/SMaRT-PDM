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
