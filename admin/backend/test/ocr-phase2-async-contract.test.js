const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const controller = fs.readFileSync(require.resolve('../controllers/piIotOcrController'), 'utf8');
const requestService = fs.readFileSync(require.resolve('../services/iotOcrRequestService'), 'utf8');
const migration = fs.readFileSync(require.resolve('../../../supabase/migrations/20260927000100_iot_ocr_async_processing_owner.sql'), 'utf8');

test('Phase 2 returns after durable acceptance and schedules backend processing', () => {
  assert.match(controller, /service\.acceptUploads/);
  assert.match(controller, /setImmediate\(async \(\) =>/);
  assert.match(controller, /status\(data\.accepted \? 202 : 200\)/);
  assert.match(controller, /OCR_ASYNC_PROCESSING_ERROR/);
});

test('Phase 2 has an atomic backend processing owner claim', () => {
  assert.match(requestService, /claimAsyncProcessing/);
  assert.match(requestService, /processing_owner IS NULL OR processing_owner = \$2/);
  assert.match(requestService, /processing_claimed_at = NOW\(\)/);
});

test('Phase 2 migration is additive and indexed for active processing', () => {
  assert.match(migration, /add column if not exists processing_owner/);
  assert.match(migration, /add column if not exists processing_claimed_at/);
  assert.match(migration, /where status = 'processing'/i);
});
