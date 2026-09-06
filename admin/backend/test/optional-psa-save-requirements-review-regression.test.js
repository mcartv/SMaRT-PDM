'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const service = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'applicationService.js'),
  'utf8'
);
const page = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'frontend', 'src', 'pages', 'DocumentVerification.jsx'),
  'utf8'
);

test('Save Requirements Review accepts the optional PSA document key', () => {
  assert.match(service, /REVIEWABLE_DOCUMENT_KEYS[\s\S]*?'birth_certificate'/);
  assert.match(service, /!REVIEWABLE_DOCUMENT_KEYS\.has\(documentKey\)/);
  assert.doesNotMatch(
    service,
    /!REQUIRED_REVIEW_DOCUMENT_KEYS\.includes\(documentKey\)/
  );
});

test('frontend continues to identify PSA as optional', () => {
  assert.match(
    page,
    /id: 'birth_certificate',[\s\S]*?required: false,/
  );
  assert.match(page, /Mobile upload optional · physical OCR required/);
});

test('successful Admin completion accepts a verified upload or confirmed physical OCR', () => {
  assert.match(service, /getUploadedPsaBirthCertificate/);
  assert.match(service, /existingPsaReview\?\.reviewStatus === 'verified'/);
  assert.match(service, /getConfirmedPsaBirthCertificateOcrReview/);
  assert.match(service, /r\.document_key = \$2/);
  assert.match(service, /r\.status = 'completed'/);
  assert.match(service, /JOIN public\.iot_ocr_reviews/);
  assert.match(
    service,
    /if \(derivedVerificationStatus === 'verified'\)[\s\S]*?!uploadedPsa && !confirmedPsaOcrReview/
  );
  assert.match(service, /reviewStatus: 'verified'/);
  assert.match(page, /isPsaBirthCertificateRequirementSatisfied/);
  assert.match(
    page,
    /finalVerificationStatus !== 'verified' \|\| psaRequirementSatisfied/
  );
  assert.match(page, /Verify PSA \/ Birth Certificate First/);
  assert.match(page, /Scan PSA \/ Birth Certificate First/);
});
