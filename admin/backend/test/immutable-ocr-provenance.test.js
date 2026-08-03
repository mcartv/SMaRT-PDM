const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const dependency of [
  '../config/supabase',
  '../config/db',
  '../services/iotOcrRequestService',
]) {
  const dependencyPath = require.resolve(dependency);
  require.cache[dependencyPath] = {
    id: dependencyPath,
    filename: dependencyPath,
    loaded: true,
    exports: {},
  };
}

const { calculateFileSha256 } = require('../services/applicationService');

const repositoryRoot = path.resolve(__dirname, '..', '..', '..');
const migrationPath = path.join(
  repositoryRoot,
  'supabase',
  'migrations',
  '20260801090000_add_immutable_ocr_provenance.sql'
);
const adminApplicationServicePath = path.join(
  repositoryRoot,
  'admin',
  'backend',
  'services',
  'applicationService.js'
);
const studentApplicationServicePath = path.join(
  repositoryRoot,
  'backend',
  'src',
  'services',
  'applicationService.js'
);
const requestServicePath = path.join(
  repositoryRoot,
  'admin',
  'backend',
  'services',
  'iotOcrRequestService.js'
);

const migration = fs.readFileSync(migrationPath, 'utf8');
const adminApplicationService = fs.readFileSync(adminApplicationServicePath, 'utf8');
const studentApplicationService = fs.readFileSync(studentApplicationServicePath, 'utf8');
const requestService = fs.readFileSync(requestServicePath, 'utf8');

test('SHA-256 is calculated from the exact uploaded bytes', () => {
  assert.equal(
    calculateFileSha256(Buffer.from('immutable-upload-bytes', 'utf8')),
    '013a853adb0a3796a026b1edd63037d118d267a1c17e64418f98198665440af2'
  );
  assert.throws(
    () => calculateFileSha256('not-a-buffer'),
    (error) => error instanceof TypeError && error.code === 'INVALID_FILE_BUFFER'
  );
});

test('both upload paths hash bytes and atomically register a document version', () => {
  for (const source of [adminApplicationService, studentApplicationService]) {
    assert.match(source, /calculateFileSha256\(file\.buffer\)/);
    assert.match(source, /register_application_document_version/);
    assert.match(source, /p_content_sha256:\s*contentSha256/);
    assert.match(source, /p_file_size_bytes:\s*file\.buffer\.length/);
    assert.match(source, /crypto\.randomUUID\(\)/);
    assert.match(source, /upsert:\s*false/);
  }
});

test('registration cleanup can remove only the newly unique uploaded object', () => {
  assert.match(adminApplicationService, /remove\(\[storagePath\]\)/);
  assert.match(studentApplicationService, /remove\(\[filePath\]\)/);
  assert.doesNotMatch(adminApplicationService, /remove\(\[previousDocument/);
  assert.doesNotMatch(studentApplicationService, /remove\(\[previousDocument/);
});

test('document version registration serializes concurrent uploads', () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(
    migration,
    /unique \(application_id, document_type, version_number\)/i
  );
  assert.match(migration, /for update;/i);
});

test('legacy uploads are backfilled without fabricated hashes', () => {
  assert.match(migration, /legacy_unhashed boolean not null default false/);
  assert.match(
    migration,
    /select[\s\S]*ad\.file_path[\s\S]*null,[\s\S]*null,[\s\S]*true,/i
  );
  assert.match(migration, /where ad\.is_submitted = true/i);
});

test('new OCR requests require an immutable version and source hash', () => {
  assert.match(migration, /iot_ocr_requests_provenance_required/);
  assert.match(requestService, /application_document_version_id/);
  assert.match(requestService, /source_content_sha256/);
  assert.match(requestService, /document must be re-uploaded before OCR can run/i);
});

test('claiming skips legacy and stale upload bindings', () => {
  assert.match(requestService, /version\.content_sha256 = request\.source_content_sha256/);
  assert.match(
    requestService,
    /document\.current_version_id = request\.application_document_version_id/
  );
  assert.match(requestService, /request\.provenance_legacy_unbound = false/);
  assert.match(requestService, /FOR UPDATE OF request SKIP LOCKED/);
});

test('OCR completion inserts a snapshot in the request transaction', () => {
  assert.match(requestService, /requestId:\s*requestRow\.request_id/);
  assert.match(
    requestService,
    /documentVersionId:\s*requestRow\.application_document_version_id/
  );
  assert.match(requestService, /dbClient:\s*client/);
  assert.match(adminApplicationService, /insert_immutable_ocr_snapshot/);
  assert.match(adminApplicationService, /\$6::uuid, \$7::text/);
  assert.ok(
    requestService.indexOf('saveApplicationDocumentOcrSnapshot') <
      requestService.indexOf("status = 'completed'"),
    'snapshot persistence must occur before request completion'
  );
  assert.match(requestService, /await client\.query\('ROLLBACK'\)/);
});

test('snapshot content and provenance cannot be updated or deleted', () => {
  assert.match(migration, /protect_immutable_ocr_snapshot_before_update/);
  assert.match(migration, /OCR snapshot content and provenance are immutable/);
  assert.match(migration, /prevent_ocr_snapshot_delete_before_delete/);
  assert.match(migration, /OCR snapshots cannot be deleted/);
  assert.match(migration, /A stale OCR snapshot cannot become current again/);
});

test('upload replacement invalidates old snapshots and pending OCR requests', () => {
  assert.match(
    migration,
    /update public\.ocr_extracted_documents[\s\S]*is_current = false[\s\S]*processing_status = case/i
  );
  assert.match(
    migration,
    /update public\.iot_ocr_requests[\s\S]*status = 'cancelled'[\s\S]*status = 'pending'/i
  );
});

test('current snapshot reads require both the current flag and upload version', () => {
  assert.match(adminApplicationService, /\.eq\('is_current', true\)/);
  assert.match(
    adminApplicationService,
    /ocrRow\.application_document_version_id !== currentVersionId/
  );
  assert.match(
    adminApplicationService,
    /'application_document_version_id',[\s\S]*currentDocument\.current_version_id/
  );
});

test('the migration grants no provenance functions to public application roles', () => {
  assert.match(
    migration,
    /revoke execute on function public\.register_application_document_version[\s\S]*from public, anon, authenticated/i
  );
  assert.match(
    migration,
    /revoke execute on function public\.insert_immutable_ocr_snapshot[\s\S]*from public, anon, authenticated/i
  );
});
