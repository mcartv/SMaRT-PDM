const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
    path.resolve(__dirname, '../services/applicationService.js'),
    'utf8'
);

const migration = fs.readFileSync(
    path.resolve(
        __dirname,
        '../sql/20260804_fix_iot_ocr_request_and_snapshot_provenance.sql'
    ),
    'utf8'
);

test('OCR snapshots are appended instead of mutating immutable content', () => {
    assert.match(source, /iotRequestId = null/);
    assert.match(source, /iot_request_id: normalizedIotRequestId/);
    assert.match(source, /\.insert\(payload\)/);
    assert.doesNotMatch(source, /\.update\(payload\)/);
    assert.match(source, /\.order\('scanned_at', \{ ascending: false \}\)/);
});

test('migration supports immutable request-bound snapshot history', () => {
    assert.match(migration, /ADD COLUMN IF NOT EXISTS iot_request_id UUID/);
    assert.match(migration, /uq_ocr_extracted_documents_iot_request/);
    assert.match(migration, /idx_ocr_extracted_documents_latest_application_document/);
    assert.match(migration, /iot_ocr_requests_provenance_required/);
});
