'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const service = fs.readFileSync(path.join(root, 'services', 'applicationService.js'), 'utf8');
const types = fs.readFileSync(path.join(root, 'utils', 'documentTypes.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'routes', 'applicationRoutes.js'), 'utf8');

test('signing document aliases and labels are available to admin review', () => {
  for (const key of ['student_signature', 'guardian_signature', 'guardian_id']) {
    assert.match(types, new RegExp(`${key}: '${key}'`));
    assert.match(service, new RegExp(`id: '${key}'`));
    assert.match(service, new RegExp(`'${key}'`));
  }
  assert.match(types, /Parent \/ Guardian Valid ID/);
});

test('signing documents are reviewable but do not extend legacy required-review keys', () => {
  assert.match(service, /const REVIEWABLE_DOCUMENT_KEYS = new Set\([\s\S]*'student_signature'[\s\S]*'guardian_signature'[\s\S]*'guardian_id'/);
  const requiredBlock = service.match(/const REQUIRED_REVIEW_DOCUMENT_KEYS = Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert.ok(requiredBlock);
  assert.doesNotMatch(requiredBlock[1], /student_signature|guardian_signature|guardian_id/);
});

test('application detail exposes guardian metadata and current version without a browser storage path', () => {
  assert.match(service, /from\('application_signing_sessions'\)/);
  assert.match(service, /guardian_name, guardian_relationship/);
  assert.match(service, /signing_metadata:/);
  assert.match(service, /current_version_number/);
});

test('document previews retain admin RBAC and signed URL authorization', () => {
  assert.match(routes, /documents\/:documentKey\/view-url'.*requirePermission\('documents\.view'\)/);
  assert.match(service, /getSignedFileUrl\(path\)/);
});
