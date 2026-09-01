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
});
