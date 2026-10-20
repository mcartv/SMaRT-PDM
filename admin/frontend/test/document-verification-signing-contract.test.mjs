import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const source = fs.readFileSync(
  path.resolve('src/pages/DocumentVerification.jsx'),
  'utf8',
);

test('signing evidence has correct labels and non-blocking review configuration', () => {
  assert.match(source, /id: 'student_signature',[\s\S]*name: 'Student Signature',[\s\S]*required: false/);
  assert.match(source, /id: 'guardian_signature',[\s\S]*name: 'Parent \/ Guardian Signature',[\s\S]*required: false/);
  assert.match(source, /id: 'guardian_id',[\s\S]*name: 'Parent \/ Guardian Valid ID',[\s\S]*required: false/);
});

test('signing evidence is grouped and guardian metadata is displayed', () => {
  assert.match(source, /key: 'signing'/);
  assert.match(source, /application\?\.signing_metadata\?\.guardian_name/);
  assert.match(source, /Compare signatures manually only/);
  assert.match(source, /no visible signature/);
});

test('previews use the authorized backend signed-url route rather than storage paths', () => {
  assert.match(source, /\/documents\/\$\{encodeURIComponent\(activeDoc\.id\)\}\/view-url/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('current version is shown when the backend returns it', () => {
  assert.match(source, /Current document version: v\{activeDoc\.current_version_number\}/);
});
