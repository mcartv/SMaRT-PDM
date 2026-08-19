'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('Birth child corrections are review-only and no longer reference-only', () => {
  const backend = read('backend/services/iotOcrRequestService.js');
  const frontend = read('frontend/src/pages/DocumentVerification.jsx');

  assert.doesNotMatch(
    backend,
    /detected child name is reference-only and cannot be changed/i
  );
  assert.doesNotMatch(
    backend,
    /await\s+upsertVerifiedBirthParents\s*\(/
  );
  assert.match(
    backend,
    /normalizeReviewReason\(reasonCode, \{ required: changedFields\.length > 0 \}\)/
  );

  assert.match(frontend, /Parents Information/);
  assert.doesNotMatch(frontend, /Child Name \(reference\)/);
  assert.match(frontend, /child_name:\s*\{/);
  assert.match(frontend, /Correct & Confirm/);
});

test('Birth V2 full-page Gemini remains independent and owns one 60-second retry', () => {
  const source = read('backend/services/birthOcrV2Service.js');

  assert.match(
    source,
    /GEMINI_FULL_PAGE_TIMEOUT_MS[\s\S]*60000/
  );
  assert.match(
    source,
    /GEMINI_FULL_PAGE_RETRY_COUNT[\s\S]*['"]1['"]/
  );
  assert.match(
    source,
    /Promise\.allSettled\(\[[\s\S]*callGeminiFullPage\(original\)/
  );
  assert.match(source, /retryAttempts:\s*1/);
  assert.match(source, /BIRTH_V2_GEMINI_FULL_PAGE_RETRY/);
  assert.match(source, /full_page_extraction_attempts/);
});
