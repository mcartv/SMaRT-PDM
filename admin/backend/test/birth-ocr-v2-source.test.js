const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const service = fs.readFileSync(path.join(backendRoot, 'services/birthOcrV2Service.js'), 'utf8');
const requestService = fs.readFileSync(path.join(backendRoot, 'services/iotOcrRequestService.js'), 'utf8');
const piController = fs.readFileSync(path.join(backendRoot, 'controllers/piIotOcrController.js'), 'utf8');
const supabaseConfig = fs.readFileSync(path.join(backendRoot, 'config/supabase.js'), 'utf8');
const migration = fs.readFileSync(
    path.resolve(backendRoot, '../../supabase/migrations/20260813000100_birth_ocr_v2_review_architecture.sql'),
    'utf8'
);

test('Birth V2 uses private signed uploads and backend schema-constrained Gemini', () => {
    assert.match(service, /createSignedUploadUrl/);
    assert.match(service, /public:\s*false/);
    assert.match(service, /responseJsonSchema:\s*RESPONSE_SCHEMA/);
    assert.match(service, /fieldConfidence/);
    assert.doesNotMatch(service, /getPublicUrl/);
    assert.doesNotMatch(supabaseConfig, /keyPrefix/);
    assert.match(service, /bytesMatchMime/);
    assert.match(service, /assertRequestStillProcessing/);
    assert.match(service, /artifact\.roi_polygon == null\s*\? null/);
    assert.match(piController, /BIRTH_V2_UPLOAD_AUTHORIZATION_ERROR/);
    assert.match(piController, /BIRTH_V2_UPLOAD_COMPLETION_ERROR/);
    assert.doesNotMatch(
        piController,
        /console\.error\('BIRTH_V2_UPLOAD_(?:AUTHORIZATION|COMPLETION)_ERROR',\s*\{[^}]*message:/
    );
});

test('Birth V2 persists first-class full-page transcription independently from structured fields', () => {
    assert.match(service, /GEMINI_REQUIRED_NAME_MISSING/);
    assert.match(service, /callGeminiFullPage\(original\)/);
    assert.match(service, /Promise\.allSettled/);
    assert.match(service, /FULL_PAGE_RESPONSE_SCHEMA/);
    assert.match(service, /rawText:\s*selected\.raw_text/);
    assert.match(service, /raw_text_source:\s*'birth_v2_full_page_gemini_literal'/);
    assert.doesNotMatch(service, /buildRawSnapshot/);
    assert.doesNotMatch(service, /partialCellSnapshot/);
    assert.match(service, /GEMINI_FALLBACK_MODELS/);
    assert.match(service, /raw_text string must remain a literal transcription/);
    assert.match(requestService, /candidate_processing\?\.diagnostic_only/);
    assert.match(requestService, /reference-only and cannot be changed/);
});

test('Birth V2 recovers required cells before a separately bounded diagnostic call', () => {
    assert.match(service, /GEMINI_DIAGNOSTIC_TIMEOUT_MS/);
    assert.match(service, /recoverRequiredNames\(client, cells, parsed\)/);
    assert.match(service, /readRequiredNameRow/);
    assert.match(service, /Promise\.all/);
    assert.match(service, /ROW_RECOVERY_SCHEMA/);
    assert.match(service, /httpOptions:\s*\{ timeout: timeoutMs \}/);
    assert.match(service, /abortSignal:\s*controller\.signal/);
    assert.match(service, /gemini-3\.6-flash/);
    assert.match(service, /gemini-3\.5-flash/);
    assert.match(service, /geminiFailureCode\(error, 'GEMINI_FULL_PAGE'\)/);
    assert.match(service, /RATE_LIMITED/);
});

test('Birth V2 diagnostic metadata keeps only normalized scan polygons', () => {
    assert.match(service, /region_mode/);
    assert.match(service, /expected_calibration/);
    assert.match(service, /source_regions/);
    assert.match(service, /normalizePolygon\(polygon\)/);
});

test('Birth V2 keeps the private original available when registration prevents nine-cell extraction', () => {
    assert.match(service, /\[1, 10\]\.includes\(artifacts\.length\)/);
    assert.match(service, /cells\.length === 0/);
    assert.match(service, /original-only upload requires diagnostic metadata/);
    assert.match(service, /private_capture_available:\s*true/);
    assert.match(piController, /diagnostic:\s*req\.body\?\.diagnostic \|\| null/);
});

test('Birth V2 duplicate suspicion uses capture hashes across applications', () => {
    assert.match(service, /a\.sha256 = \$1/);
    assert.match(service, /r\.application_id <> \$2::uuid/);
    assert.doesNotMatch(service, /name similarity/i);
});

test('review_required may transition to failed for reject and rescan', () => {
    assert.match(requestService, /review_required:\s*Object\.freeze\(\['completed', 'failed', 'expired'\]\)/);
    assert.match(requestService, /ADMIN_REJECTED/);
    assert.match(requestService, /ADMIN_RESCAN_REQUESTED/);
    assert.match(requestService, /createReplacement && previous\.status === 'failed'/);
    assert.match(requestService, /retry_of_request_id/);
});

test('V2 schema has immutable review events and protected private artifact metadata', () => {
    assert.match(migration, /ocr_version in \('v1', 'v2'\)/i);
    assert.match(migration, /iot_ocr_capture_artifacts/i);
    assert.match(migration, /iot_ocr_review_exceptions/i);
    assert.match(migration, /trg_iot_ocr_review_events_immutable/i);
    assert.match(migration, /revoke all on public\.iot_ocr_capture_artifacts from anon, authenticated/i);
    assert.match(migration, /grant select, insert on public\.iot_ocr_review_events to smart_pdm_runtime/i);
    assert.match(migration, /revoke update, delete, truncate on public\.iot_ocr_review_events from smart_pdm_runtime/i);
});
