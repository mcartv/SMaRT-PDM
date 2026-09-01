const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const adminRoot = path.resolve(backendRoot, '..');

const docReview = fs.readFileSync(
  path.join(adminRoot, 'frontend', 'src', 'pages', 'DocumentVerification.jsx'),
  'utf8'
);
const profileQueue = fs.readFileSync(
  path.join(adminRoot, 'frontend', 'src', 'pages', 'ProfilePhotoQueue.jsx'),
  'utf8'
);
const applicationService = fs.readFileSync(
  path.join(backendRoot, 'services', 'applicationService.js'),
  'utf8'
);
const documentTypes = fs.readFileSync(
  path.join(backendRoot, 'utils', 'documentTypes.js'),
  'utf8'
);

test('Review PSA/Birth Certificate requirement wording', () => {
  assert.ok(docReview.includes("name: 'PSA / Birth Certificate'"));
  assert.ok(applicationService.includes("name: 'PSA / Birth Certificate'"));
  assert.ok(documentTypes.includes("birth_certificate: 'PSA / Birth Certificate'"));
});

test('Use consistent PSA / Birth Certificate terminology', () => {
  // Check visible/canonical labels only. Historical lower-case aliases such as
  // 'birth certificate / psa' remain intentionally for document matching.
  assert.equal(docReview.includes('Birth Certificate / PSA'), false);
  assert.equal(docReview.includes('PSA/Birth Certificate'), false);
  assert.equal(documentTypes.includes("birth_certificate: 'Birth Certificate / PSA'"), false);
  assert.equal(applicationService.includes("name: 'Birth Certificate / PSA'"), false);
  assert.equal(applicationService.includes("birth_certificate: 'Birth Certificate / PSA'"), false);
  assert.ok(docReview.includes('PSA / Birth Certificate Detection'));
});

test('Ensure the same requirement name is used in applicant requirements', () => {
  assert.ok(docReview.includes("id: 'birth_certificate'"));
  assert.ok(applicationService.includes("id: 'birth_certificate'"));
  assert.ok(docReview.includes("name: 'PSA / Birth Certificate'"));
  assert.ok(applicationService.includes("name: 'PSA / Birth Certificate'"));
  assert.match(docReview, /id: 'birth_certificate',[\s\S]*?required: false,/);
  assert.doesNotMatch(
    applicationService.match(/const REQUIRED_REVIEW_DOCUMENT_KEYS[\s\S]*?\]\);/)?.[0] || '',
    /birth_certificate/
  );
  assert.match(
    applicationService,
    /const REVIEWABLE_DOCUMENT_KEYS = new Set\([\s\S]*?'birth_certificate'/
  );
  assert.match(
    applicationService,
    /!REVIEWABLE_DOCUMENT_KEYS\.has\(documentKey\)/
  );
});

test('optional PSA review is accepted but excluded from required completion', () => {
  const requiredKeys =
    applicationService.match(/const REQUIRED_REVIEW_DOCUMENT_KEYS[\s\S]*?\]\);/)?.[0] || '';
  const requiredOutcome =
    applicationService.match(/const requiredReviews = REQUIRED_REVIEW_DOCUMENT_KEYS\.map[\s\S]*?deriveVerificationOutcome\(requiredReviews\)/)?.[0] || '';

  assert.doesNotMatch(requiredKeys, /birth_certificate/);
  assert.match(requiredOutcome, /REQUIRED_REVIEW_DOCUMENT_KEYS\.map/);
  assert.match(requiredOutcome, /deriveVerificationOutcome\(requiredReviews\)/);
});

test('Ensure web document review displays the correct document type', () => {
  assert.ok(docReview.includes('const REQUIRED_DOCUMENTS = ['));
  assert.ok(docReview.includes("name: 'PSA / Birth Certificate'"));
});

test('Do not break existing PSA OCR/document mapping', () => {
  for (const source of [applicationService, documentTypes]) {
    assert.ok(source.includes("birth_certificate_psa: 'birth_certificate'"));
    assert.ok(source.includes("psa_birth_certificate: 'birth_certificate'"));
    assert.ok(source.includes("psa: 'birth_certificate'"));
    assert.ok(source.includes("nso: 'birth_certificate'"));
  }
  assert.ok(applicationService.includes("'birth certificate / psa'"));
  assert.ok(applicationService.includes("'psa birth certificate'"));
});

test('Clean up Profile Photos page layout', () => {
  assert.ok(profileQueue.includes('SMART-PDM_PROFILE_PHOTO_UI_CLEANUP_V2'));
  assert.ok(profileQueue.includes('className="min-w-0 space-y-4 py-3"'));
  assert.ok(profileQueue.includes('Open Review'));
});

test('Remove redundant information/actions', () => {
  assert.equal(profileQueue.includes('function ImagePreview'), false);
  const duplicateStudentStatus = '<h2 className="text-sm font-semibold text-stone-900">Student Information</h2>\n                        {detail?.status ? <StatusPill status={detail.status} /> : null}';
  assert.equal(profileQueue.includes(duplicateStudentStatus), false);
});

test('Make status badges consistent', () => {
  assert.ok(profileQueue.includes('text-xs font-medium capitalize ring-1'));
  assert.ok(profileQueue.includes('text-[10px] font-medium uppercase tracking-wide text-emerald-700'));
});

test('Keep profile-photo preview easy to access', () => {
  assert.ok(profileQueue.includes('ProfilePhotoPreviewDialog'));
  assert.ok(profileQueue.includes('openPhotoPreview('));
  assert.ok(profileQueue.includes('aria-label='));
  assert.ok(profileQueue.includes('Enlarge'));
});

test('Keep approve/reject actions clear', () => {
  assert.ok(profileQueue.includes('Approve Photo'));
  assert.ok(profileQueue.includes('Reject Photo'));
  assert.ok(profileQueue.includes('h-9 w-full'));
  assert.ok(profileQueue.includes('text-xs font-medium'));
});

test('Keep rejection Reason/Remarks workflow', () => {
  assert.ok(profileQueue.includes('Rejection reason'));
  assert.ok(profileQueue.includes('Remarks'));
  assert.ok(profileQueue.includes('onSubmit({ reason: trimmedReason, remarks: remarks.trim() })'));
});

test('Match typography and spacing with other Maintenance modules', () => {
  assert.ok(profileQueue.includes('text-base font-semibold text-stone-900">Profile Photos'));
  assert.ok(profileQueue.includes('text-xs font-medium'));
  assert.ok(profileQueue.includes('rounded-lg'));
});

test('Verify smaller-screen responsiveness', () => {
  assert.ok(profileQueue.includes('grid w-full grid-cols-2'));
  assert.ok(profileQueue.includes('md:hidden'));
  assert.ok(profileQueue.includes('hidden overflow-x-auto md:block'));
  assert.ok(profileQueue.includes('break-words text-lg font-semibold'));
  assert.ok(profileQueue.includes('min-h-[260px]'));
});
