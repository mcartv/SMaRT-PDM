const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const frontendRoot = path.join(mobileRoot, 'frontend');

const source = fs.readFileSync(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'applicant',
    'presentation',
    'screens',
    'new_applicant_screen.dart'
  ),
  'utf8'
);

test('updated Application Form asks for confirmation before saving', () => {
  const confirmationCall = source.indexOf(
    'await _confirmUpdatedApplicationSubmission()'
  );
  const providerSave = source.indexOf(
    'final success = await provider.submitApplication('
  );

  assert.ok(confirmationCall >= 0);
  assert.ok(providerSave >= 0);
  assert.ok(
    confirmationCall < providerSave,
    'confirmation must happen before provider.submitApplication'
  );
});

test('confirmation has a clear last-minute Back to Edit action', () => {
  assert.match(source, /Back to Edit/);
  assert.match(source, /Navigator\.of\(dialogContext\)\.pop\(false\)/);
});

test('confirmation has an explicit Submit for Verification action', () => {
  assert.match(source, /Submit for Verification/);
  assert.match(source, /Navigator\.of\(dialogContext\)\.pop\(true\)/);
});

test('confirmation clearly explains verification locking', () => {
  assert.match(
    source,
    /Edit Form will be temporarily[\s\S]*disabled while OSFA\/Admin verifies your update/
  );
  assert.match(source, /another correction is required/);
});

test('confirmation reminds the applicant to triple-check important details', () => {
  assert.match(source, /Triple-check your personal, family, academic/);
  assert.match(source, /important information are complete and correct/);
});

test('old post-save acknowledgement dialog is removed', () => {
  assert.doesNotMatch(
    source,
    /Application Form Submitted for Verification/
  );
  assert.doesNotMatch(
    source,
    /child: const Text\('Got it'\)/
  );
});

test('successful edit returns to Preview Form only after the actual save succeeds', () => {
  assert.match(
    source,
    /if \(widget\.editExistingApplication\) \{\s*Navigator\.of\(context\)\.pop\(true\);\s*return;\s*\}/
  );
});

test('dialog remains responsive on narrow mobile screens', () => {
  assert.match(source, /ConstrainedBox\(/);
  assert.match(source, /maxWidth: 440/);
  assert.match(source, /LayoutBuilder\(/);
  assert.match(source, /constraints\.maxWidth < 330/);
  assert.match(source, /SingleChildScrollView\(/);
});
