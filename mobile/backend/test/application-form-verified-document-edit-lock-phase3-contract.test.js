'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const service = fs.readFileSync(
  path.join(backendRoot, 'src', 'services', 'applicationService.js'),
  'utf8'
);
const preview = fs.readFileSync(
  path.join(
    mobileRoot,
    'frontend',
    'lib',
    'features',
    'applicant',
    'presentation',
    'screens',
    'application_form_preview_screen.dart'
  ),
  'utf8'
);

test('submitted-form editability reads actual uploaded document state', () => {
  const start = service.indexOf('async function getMySubmittedFormData');
  const end = service.indexOf('\nasync function getMyApplicationById', start);
  const block = service.slice(start, end);

  assert.match(block, /\.from\('application_documents'\)/);
  assert.match(
    block,
    /document_type, is_submitted, file_path, file_url, current_version_id, review_status/
  );
  assert.match(block, /const applicationDocumentRows = applicationDocumentsResult\.data \|\| \[\]/);
});

test('only a real submitted supporting file can trigger the verified-requirement lock', () => {
  assert.match(service, /const hasVerifiedUploadedDocument = applicationDocumentRows\.some/);
  assert.match(service, /document\.is_submitted !== true/);
  assert.match(service, /safeText\(document\.file_path\)/);
  assert.match(service, /safeText\(document\.file_url\)/);
  assert.match(service, /safeText\(document\.current_version_id\)/);
  assert.match(service, /APPLICATION_UPLOAD_DOCUMENT_TYPES\.includes\(normalizedType\)/);
  assert.match(service, /normalizeReviewDecision\(document\.review_status\) === 'verified'/);
});

test('legacy supporting review rows can confirm verification without treating Application Form as a supporting file', () => {
  assert.match(service, /const supportingReviewStatusByKey = new Map/);
  assert.match(service, /!== 'application_form'/);
  assert.match(service, /reviewKeyForRequiredDocumentType\(\s*document\.document_type\s*\)/s);
  assert.match(service, /supportingReviewStatusByKey\.get\(reviewKey\) === 'verified'/);
});

test('verified supporting document locks edit while an explicit Application Form correction reopens it', () => {
  assert.match(
    service,
    /const verifiedRequirementLocked =\s*lifecycleCanEdit &&\s*hasVerifiedUploadedDocument &&\s*!applicationFormCorrectionRequested &&\s*!applicationFormAwaitingVerification &&\s*applicationFormReviewStatus !== 'verified';/s
  );
  assert.match(
    service,
    /const canEdit =\s*lifecycleCanEdit &&\s*!applicationFormAwaitingVerification &&\s*applicationFormReviewStatus !== 'verified' &&\s*!verifiedRequirementLocked;/s
  );
  assert.match(service, /verified_requirement_locked:\s*verifiedRequirementLocked/);
});

test('Preview Form shows a plain-language locked state and keeps preview/export available', () => {
  assert.match(preview, /bool _verifiedRequirementLocked = false;/);
  assert.match(
    preview,
    /editability\['verified_requirement_locked'\] == true/
  );
  assert.match(preview, /'Form Locked'/);
  assert.match(
    preview,
    /One of your submitted requirements has already been verified, so your Application Form is now locked/
  );
  assert.match(preview, /You can still review or export it/);
  assert.match(preview, /onPressed: canExport \? _exportPdf : null/);
  assert.match(preview, /onPressed: canEdit \? _openEditor : null/);
});

test('student-facing editability text avoids implementation terminology', () => {
  const start = preview.indexOf('String _editabilityMessage()');
  const end = preview.indexOf('\n  String _text(', start);
  const block = preview.slice(start, end).toLowerCase();

  for (const term of ['database', 'backend', 'review row', 'fcfs']) {
    assert.equal(block.includes(term), false, `unexpected technical term: ${term}`);
  }
});
