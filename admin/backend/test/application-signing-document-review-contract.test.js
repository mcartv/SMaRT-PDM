'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const service = fs.readFileSync(path.join(root, 'services', 'applicationService.js'), 'utf8');
const types = fs.readFileSync(path.join(root, 'utils', 'documentTypes.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'routes', 'applicationRoutes.js'), 'utf8');
const signingFinalization = fs.readFileSync(
  path.resolve(root, '..', '..', 'supabase', 'migrations', '20261021000000_fix_signing_document_version_order.sql'),
  'utf8',
);

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
  assert.match(service, /\.eq\('application_id', applicationId\)/);
  assert.match(service, /getDocumentKey\(row\) === key/);
  assert.match(service, /document\.is_submitted !== true \|\| !document\.file_path/);
  assert.match(service, /getSignedFileUrl\(path\)/);
});

test('finalized guardian evidence is persisted as submitted application documents', () => {
  assert.match(signingFinalization, /v_session\.guardian_signature_path is null or v_session\.guardian_id_path is null/);
  assert.match(signingFinalization, /v_type = 'Guardian Signature'[\s\S]*v_session\.guardian_signature_path/);
  assert.match(signingFinalization, /v_path := v_session\.guardian_id_path/);
  assert.match(signingFinalization, /is_submitted = true[\s\S]*submitted_at = now\(\)/);
  assert.match(signingFinalization, /set application_id = p_application_id,[\s\S]*status = 'finalized'/);
});
