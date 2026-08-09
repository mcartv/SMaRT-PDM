const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
    path.resolve(__dirname, '../../../supabase/migrations/20260809000100_canonical_iot_ocr_candidates.sql'),
    'utf8'
);

test('candidate storage is UUID-based, unique per request, and immutable', () => {
    assert.match(migration, /candidate_id uuid primary key default gen_random_uuid\(\)/i);
    assert.match(migration, /request_id uuid not null unique/i);
    assert.match(migration, /before update or delete on public\.iot_ocr_candidates/i);
    assert.match(migration, /revoke update, delete, truncate/i);
    assert.match(migration, /grant select, insert/i);
});

test('review_required is valid but excluded from active-work uniqueness', () => {
    assert.match(migration, /'review_required'/);
    const index = migration.match(/create unique index uq_iot_ocr_active_request[\s\S]*?\);/i)?.[0] || '';
    assert.doesNotMatch(index, /review_required/i);
});

test('runtime role ownership and superuser hardening is present', () => {
    assert.match(migration, /smart_pdm_runtime must not be a superuser/i);
    assert.match(migration, /smart_pdm_runtime must not own iot_ocr_candidates/i);
});
