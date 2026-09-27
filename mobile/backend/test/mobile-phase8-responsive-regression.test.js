const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const mobileRoot = path.resolve(__dirname, '../..');
const read = (relativePath) =>
  fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');

const openings = read(
  'frontend/lib/features/applicant/presentation/screens/scholarship_openings_screen.dart'
);
const changeEmail = read(
  'frontend/lib/features/auth/presentation/screens/change_email_screen.dart'
);
const studentLookup = read(
  'frontend/lib/features/auth/presentation/screens/student_lookup_screen.dart'
);

test('available scholarships adapts status and requirement summaries without changing workflow', () => {
  assert.match(openings, /scrollable: true/);
  assert.match(openings, /constraints\.maxWidth < 320 \|\| textScale > 1\.25/);
  assert.match(openings, /constraints\.maxWidth < 300 \|\| textScale > 1\.25/);
  assert.match(openings, /MediaQuery\.textScalerOf\(context\)\.scale\(1\)/);

  assert.match(openings, /fetchAvailableOpenings\(\)/);
  assert.match(openings, /AppRoutes\.newApplicant/);
  assert.match(openings, /AppRoutes\.documents/);
  assert.match(openings, /Duration\(seconds: 20\)/);
});

test('change email actions use minimum height so large text can grow', () => {
  assert.equal(
    (changeEmail.match(/minimumSize: const Size\.fromHeight\(52\)/g) || []).length,
    2
  );
  assert.doesNotMatch(
    changeEmail,
    /SizedBox\(\s*height:\s*52,\s*child:\s*ElevatedButton/
  );

  assert.match(changeEmail, /requestEmailChange/);
  assert.match(changeEmail, /verifyEmailChange/);
  assert.match(changeEmail, /saveProfileCache\(email: newEmail\)/);
});

test('student lookup action can grow while registry and auth routing stay unchanged', () => {
  assert.match(studentLookup, /minimumSize: const Size\.fromHeight\(52\)/);
  assert.doesNotMatch(
    studentLookup,
    /SizedBox\(\s*height:\s*52,\s*child:\s*FilledButton/
  );
  assert.match(studentLookup, /maxLines: 2/);
  assert.match(studentLookup, /\/api\/auth\/check-student-id/);
  assert.match(studentLookup, /AppRoutes\.register/);
  assert.match(studentLookup, /AppRoutes\.login/);
});
