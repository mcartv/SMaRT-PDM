const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const serviceSource = fs.readFileSync(require.resolve('../services/iotOcrRequestService'), 'utf8');
const recoverySource = fs.readFileSync(require.resolve('../services/ocrProcessingRecoveryService'), 'utf8');
const migration = fs.readFileSync(require.resolve('../../../supabase/migrations/20260927000200_iot_ocr_retry_recovery.sql'), 'utf8');

test('Phase 3 persists bounded retry state and clears ownership atomically', () => {
  for (const field of ['processing_attempt_count', 'processing_retry_at', 'processing_last_error_code', 'processing_last_error_at']) {
    assert.match(migration, new RegExp(`add column if not exists ${field}`));
  }
  assert.match(serviceSource, /processing_attempt_count = processing_attempt_count \+ 1/);
  assert.match(serviceSource, /processing_owner = NULL/);
  assert.match(serviceSource, /processing_claimed_at = NULL/);
  assert.match(serviceSource, /status = 'processing'/);
  assert.match(serviceSource, /status = 'failed'/);
});

test('Phase 3 reconciliation claims due retries and stale owners with row locking', () => {
  assert.match(serviceSource, /processing_retry_at <= NOW\(\)/);
  assert.match(serviceSource, /processing_claimed_at < NOW\(\) -/);
  assert.match(serviceSource, /FOR UPDATE SKIP LOCKED/);
  assert.match(recoverySource, /claimDueOrStaleProcessing/);
  assert.match(recoverySource, /ocr_processing_metadata\?\.diagnostic/);
  assert.match(recoverySource, /failProcessing/);
});

test('Phase 3 runtime recovery is bounded to V2 OCR document services', () => {
  assert.match(recoverySource, /birth_certificate/);
  assert.match(recoverySource, /student_grade_forms/);
  assert.match(recoverySource, /certificate_of_indigency/);
  assert.match(recoverySource, /request\.ocr_version !== 'v2'/);
});
