'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..', '..');
const migration = fs.readFileSync(
    path.join(repoRoot, 'supabase', 'migrations', '20261020_add_application_signing_document_corrections.sql'),
    'utf8'
);
const service = fs.readFileSync(
    path.join(backendRoot, 'src', 'services', 'applicationService.js'),
    'utf8'
);
const signingService = fs.readFileSync(
    path.join(backendRoot, 'src', 'services', 'applicationSigningService.js'),
    'utf8'
);
const routes = fs.readFileSync(
    path.join(backendRoot, 'src', 'routes', 'applicationRoutes.js'),
    'utf8'
);

test('successful signing correction is versioned and returns to pending review', () => {
    assert.match(migration, /insert into public\.application_document_versions/);
    assert.match(migration, /coalesce\(max\(version_number\), 0\) \+ 1/);
    assert.match(migration, /current_version_id = v_version_id/);
    assert.match(migration, /review_status = 'pending'/);
    assert.match(migration, /on conflict \(application_id, document_key\) do update set/);
    assert.match(migration, /'version_number', v_version_number/);
});

test('correction rejects non-requested and non-signing document states', () => {
    assert.match(migration, /document_type not in \('Student Signature', 'Guardian Signature', 'Guardian ID'\)/);
    assert.match(migration, /v_document\.is_submitted is not true or v_document\.current_version_id is null/);
    assert.match(migration, /review_status, ''\)\) <> 'reupload_required'/);
    assert.match(service, /This signing document has not been marked for correction/);
});

test('correction proves applicant ownership and keeps storage paths server-side', () => {
    assert.match(migration, /join public\.students s on s\.student_id = a\.student_id/);
    assert.match(migration, /s\.user_id = p_user_id/);
    assert.match(service, /application-signing-corrections\/\$\{application\.application_id\}\/\$\{documentId\}/);
    assert.match(service, /const \{ file_path, preview_path, \.\.\.safeDocument \} = document/);
    assert.doesNotMatch(migration.match(/return jsonb_build_object\([\s\S]*?\);/)[0], /file_path/);
});

test('dedicated authenticated route validates actual file bytes before the RPC', () => {
    assert.match(routes, /'\/me\/signing-documents\/:documentId\/upload'/);
    assert.match(routes, /protect,\s*signingUpload\.single\('document'\),\s*applicationController\.replaceMySigningDocument/);
    assert.match(service, /validateSigningDocumentFile\(signingType, file\)/);
    assert.match(signingService, /fileType\(file\)/);
    assert.match(signingService, /maxBytes/);
});

test('previous versions are retained and the admin review queue receives the new version', () => {
    assert.doesNotMatch(migration, /delete\s+from\s+public\.application_document_versions/i);
    assert.match(service, /Signing correction ready for review/);
    assert.match(migration, /admin_comment = ''/);
    assert.match(migration, /reviewed_by = null/);
});
