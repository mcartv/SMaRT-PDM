'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

const source = read('backend/services/applicationService.js');

function getVerificationReviewLoop() {
  const startMarker = '    for (const review of normalizedReviews) {';
  const endMarker = '    const majorReviews = requiredReviews.filter(';

  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  assert.notEqual(start, -1, 'normalizedReviews loop should exist');
  assert.notEqual(end, -1, 'normalizedReviews loop end should exist');

  return source.slice(start, end);
}

test('verification does not destroy persistent upload metadata', () => {
  const loop = getVerificationReviewLoop();

  assert.doesNotMatch(
    loop,
    /is_submitted:\s*!!review\.url/
  );

  assert.doesNotMatch(
    loop,
    /file_url:\s*review\.url/
  );

  assert.match(
    loop,
    /review_status:\s*review\.reviewStatus/
  );
});

test('verification clears cached document metadata after review update', () => {
  const loop = getVerificationReviewLoop();

  assert.match(
    loop,
    /documentViewMetadataCache\.delete\([\s\S]*applicationId[\s\S]*review\.documentKey/
  );
});

test('secure preview endpoint still requires persisted upload state', () => {
  assert.match(
    source,
    /document\.is_submitted !== true \|\| !document\.file_path/
  );
});
