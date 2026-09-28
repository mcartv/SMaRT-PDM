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
  assert.match(frontend, /BIRTH_OCR_DOCUMENT_KEYS/);
  assert.match(frontend, /BIRTH_OCR_LOOKUP_DOCUMENT_IDS = \[/);
  assert.match(frontend, /'certificate_of_live_birth'/);
  assert.match(frontend, /candidateDocumentIds = BIRTH_OCR_LOOKUP_DOCUMENT_IDS/);
  assert.match(frontend, /documents\/\$\{documentId\}\/iot-ocr\?prefer_reviewed=1/);
  assert.doesNotMatch(frontend, /Child Name \(reference\)/);
  assert.match(frontend, /child_name:\s*\{/);
  assert.match(frontend, /Correct & Confirm/);
});

test('Birth parent sidebar keeps the latest reviewed OCR while rescans are running', () => {
  const controller = read('backend/controllers/applicationController.js');
  const applicationService = read('backend/services/applicationService.js');
  const ocrService = read('backend/services/iotOcrRequestService.js');

  assert.match(controller, /preferReviewed:\s*req\.query\?\.prefer_reviewed === '1'/);
  assert.match(applicationService, /preferReviewed = false/);
  assert.match(ocrService, /preferReviewed = false/);
  assert.match(
    ocrService,
    /CASE WHEN v\.request_id IS NOT NULL OR r\.status = 'completed' THEN 0 ELSE 1 END/
  );
  assert.match(
    ocrService,
    /COALESCE\(v\.reviewed_at, r\.reviewed_at, r\.completed_at, r\.created_at\) DESC/
  );
});

test('Birth V2 full-page OCR keeps bounded transient retries and private failure diagnostics', () => {
  const source = read('backend/services/birthOcrV2Service.js');

  assert.match(
    source,
    /GEMINI_FULL_PAGE_TIMEOUT_MS[\s\S]*60000/
  );
  assert.match(
    source,
    /GEMINI_FULL_PAGE_RETRY_COUNT[\s\S]*['"]2['"]/
  );
  assert.match(
    source,
    /Promise\.allSettled\(\[[\s\S]*callGeminiFullPage\(original\)/
  );
  assert.match(source, /retryAttempts:\s*1/);
  assert.match(source, /BIRTH_V2_GEMINI_FULL_PAGE_RETRY/);
  assert.match(source, /DAILY_QUOTA_EXHAUSTED/);
  assert.match(source, /RATE_LIMITED/);
  assert.match(source, /TEMPORARY_PROVIDER_FAILURE/);
  assert.match(source, /internal_reason:\s*failure\.internalReason/);
  assert.match(source, /provider_status:\s*failure\.providerStatus/);
  assert.match(source, /full_page_internal_reason/);
  assert.match(source, /full_page_provider_status/);
  assert.match(source, /full_page_extraction_attempts/);

  const frontend = read('frontend/src/pages/DocumentVerification.jsx');
  assert.match(frontend, /function publicOcrDiagnosticCode/);
  assert.match(frontend, /FULL_PAGE_UNAVAILABLE/);
  assert.match(frontend, /OCR_UNAVAILABLE/);
});
