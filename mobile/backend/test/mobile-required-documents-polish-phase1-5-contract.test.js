const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const screen = fs.readFileSync(
  path.join(root, 'mobile/frontend/lib/features/applicant/presentation/screens/applicant_documents_screen.dart'),
  'utf8'
);

test('progress summary is compact instead of three mini boxes', () => {
  assert.match(screen, /Required document progress/);
  assert.match(screen, /document\$\{missing == 1 \? '' : 's'\} remaining/);
  assert.match(screen, /your attention/);
  assert.doesNotMatch(screen, /class _InfoChip/);
});

test('page removes redundant dashboard action and keeps application form as a secondary action', () => {
  assert.match(screen, /TextButton\.icon\(/);
  assert.match(screen, /'View Application Form'/);
  assert.doesNotMatch(screen, /'Back to Dashboard'/);
  assert.doesNotMatch(screen, /AppNavigator\.goToTopLevel/);
});

test('verified locked documents do not render fake disabled action buttons', () => {
  assert.match(screen, /final uploadButton = onUpload == null/);
  assert.match(screen, /\? null\s*: ElevatedButton\.icon/);
  assert.doesNotMatch(screen, /Verified — Locked/);
});

test('short statuses use pills while long statuses render as ordinary status text', () => {
  assert.match(screen, /class _DocumentStatus/);
  assert.match(screen, /label == 'Verified'/);
  assert.match(screen, /label == 'Missing'/);
  assert.match(screen, /Text\(\s*'Status'/s);
  assert.match(screen, /Uploaded — Pending Review/);
});

test('review notes and replacement confirmation use student-facing wording', () => {
  assert.match(screen, /Review note:/);
  assert.match(screen, /Your current file will stay available until the replacement/);
  assert.match(screen, /new file will then be reviewed again/);
  assert.doesNotMatch(screen, /Previous document versions are preserved for review history/);
});

test('existing additional document wording remains intact', () => {
  assert.match(screen, /'Additional Documents'/);
  assert.match(screen, /Upload or bring physical copy/);
  assert.doesNotMatch(screen, /Optional Documents/);
});
