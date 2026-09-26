'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const service = fs.readFileSync(
  path.join(repoRoot, 'admin', 'backend', 'services', 'applicationService.js'),
  'utf8'
);
const routes = fs.readFileSync(
  path.join(repoRoot, 'admin', 'backend', 'routes', 'applicationRoutes.js'),
  'utf8'
);
const page = fs.readFileSync(
  path.join(repoRoot, 'admin', 'frontend', 'src', 'pages', 'DocumentVerification.jsx'),
  'utf8'
);

test('document review action has an immediate persistence endpoint', () => {
  assert.match(routes, /documents\/:documentKey\/review/);
  assert.match(service, /saveApplicationDocumentReview/);
  assert.match(service, /application_document_reviews/);
  assert.match(service, /onConflict: 'application_id,document_key'/);
});

test('document review also updates persisted document review metadata', () => {
  assert.match(service, /review_status: reviewStatus/);
  assert.match(service, /reviewed_at: reviewedAt/);
  assert.match(service, /documentViewMetadataCache\.delete/);
});

test('frontend review actions call the persistence endpoint', () => {
  assert.match(page, /persistActiveDocStatus/);
  assert.match(page, /documents\/\$\{encodeURIComponent\(targetDocument\.id\)\}\/review/);
  assert.match(page, /method: 'PATCH'/);
});

test('review actions use scoped Sonner app toasts instead of disappearing silently', () => {
  assert.match(page, /showAppToast/);
  assert.match(page, /document-review:\$\{id\}:\$\{targetDocument\.id\}:\$\{nextStatus\}/);
  assert.match(page, /application-form-reedit:\$\{id\}/);
  assert.match(page, /requirements-review:\$\{id\}/);
});
