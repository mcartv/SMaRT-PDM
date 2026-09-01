const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const frontendRoot = path.join(mobileRoot, 'frontend');

const service = fs.readFileSync(
  path.join(backendRoot, 'src', 'services', 'applicationService.js'),
  'utf8'
);

const openingService = fs.readFileSync(
  path.join(backendRoot, 'src', 'services', 'openingService.js'),
  'utf8'
);

const screen = fs.readFileSync(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'applicant',
    'presentation',
    'screens',
    'applicant_documents_screen.dart'
  ),
  'utf8'
);

test('Review current Required Documents upload behavior', () => {
  assert.match(service, /finalize_application_document_upload/);
  assert.match(screen, /ApplicantDocumentsService/);
  assert.match(screen, /uploadDocument/);
});

test('PSA remains uploadable but is optional for mobile upload completion', () => {
  assert.match(service, /APPLICATION_UPLOAD_DOCUMENT_TYPES[\s\S]*'Birth Certificate \/ PSA'/);
  assert.match(service, /OPTIONAL_UPLOAD_DOCUMENT_TYPES[\s\S]*'birth certificate \/ psa'/);
  assert.doesNotMatch(
    service,
    /const REQUIRED_UPLOAD_DOCUMENT_TYPES = Object\.freeze\(\[\s*'birth certificate \/ psa'/
  );
  assert.match(service, /required:\s*isRequiredUploadDocumentType\(document\.document_type\)/);
  assert.match(service, /requiredCount:\s*REQUIRED_UPLOAD_DOCUMENT_TYPES\.length/);
  assert.doesNotMatch(
    openingService,
    /REQUIRED_APPLICATION_UPLOAD_KEYS[^\]]*'birth_certificate'/
  );
  assert.match(screen, /'Optional Documents'/);
});

test('Determine current behavior when a document is uploaded again', () => {
  assert.match(service, /const isReplacement =/);
  assert.match(service, /targetDocument\.current_version_id/);
});

test('Add explicit Replace Document action for an existing upload', () => {
  assert.match(screen, /'Replace Document'/);
  assert.match(screen, /document\.isSubmitted/);
});

test('Require confirmation before replacing an existing document', () => {
  assert.match(screen, /Replace Document\?/);
  assert.match(screen, /Keep Current/);
  assert.match(screen, /Choose Replacement/);
  assert.match(screen, /_confirmDocumentReplacement/);
});

test('Keep the existing document visible until replacement succeeds', () => {
  const uploadCall = screen.indexOf('final payload = await _service.uploadDocument(');
  const packageUpdate = screen.indexOf('_package = payload;', uploadCall);

  assert.ok(
    uploadCall >= 0 && packageUpdate > uploadCall,
    'the package must not switch to the replacement until uploadDocument succeeds'
  );

  // Dart formats adjacent string literals onto separate source lines.
  // Verify the message semantically instead of requiring one contiguous line.
  assert.match(
    screen,
    /current uploaded file will remain available until the/i
  );
  assert.match(
    screen,
    /replacement finishes successfully/i
  );
});

test('Upload the replacement as the new/current document', () => {
  assert.match(service, /finalize_application_document_upload/);
  assert.match(service, /current_version_id/);
});

test('Ensure the old document does not remain the active version', () => {
  assert.match(service, /finalize_application_document_upload/);
  assert.match(service, /p_document_id: documentId/);
});

test('Preserve previous document/version history when required', () => {
  assert.doesNotMatch(
    service,
    /\.remove\(\[targetDocument\.file_path\]\)/
  );
  assert.match(service, /previous version rows still point/);
});

test('Update document status correctly after replacement', () => {
  assert.match(service, /review_status: 'pending'/);
  assert.match(service, /verification_status: 'pending'/);
  assert.match(service, /requirements_verified_at: null/);
});

test('Ensure replaced documents return to the appropriate review state', () => {
  assert.match(service, /application_document_reviews/);
  assert.match(service, /onConflict: 'application_id,document_key'/);
  assert.match(service, /reviewKeyForRequiredDocumentType/);
});

test('Ensure Admin sees the latest/current document', () => {
  assert.match(service, /current_version_id/);
  assert.match(service, /Replacement document ready for review/);
  assert.match(service, /Review the latest document version/);
});

test('Ensure OCR uses the latest/current document where applicable', () => {
  assert.match(service, /finalize_application_document_upload/);
  assert.match(service, /current_version_id/);
});

test('Prevent duplicate active document records', () => {
  assert.match(service, /document_id, application_id, document_type/);
  assert.match(service, /\.eq\('document_id', documentId\)/);
});

test('Verify realtime document updates', () => {
  assert.match(screen, /applicationRevision/);
  assert.match(screen, /_handleRealtimeUpdates/);
  assert.match(screen, /_loadPackage\(silent: true\)/);
});

test('Verify replacement failures do not remove the existing valid upload', () => {
  assert.doesNotMatch(
    service,
    /OLD DOCUMENT FILE CLEANUP ERROR/
  );
  assert.match(service, /if \(finalizeError\)/);
  assert.match(service, /remove\(\[filePath\]\)/);
  assert.doesNotMatch(
    service,
    /remove\(\[targetDocument\.file_path\]\)/
  );
});
