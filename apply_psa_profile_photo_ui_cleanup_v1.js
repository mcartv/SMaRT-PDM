const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PATCH_NAME = 'SMaRT-PDM PSA Terminology + Profile Photos UI Cleanup v1';
const PSA_MARKER = 'SMART-PDM_PSA_BIRTH_CERTIFICATE_TERMINOLOGY_V1';
const PROFILE_MARKER = 'SMART-PDM_PROFILE_PHOTO_UI_CLEANUP_V1';

function parseArgs(argv) {
  let dryRun = false;
  let root = '.';

  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else root = arg;
  }

  return { dryRun, root: path.resolve(root) };
}

function normalizeNewlines(value) {
  return String(value ?? '').replace(/\r\n/g, '\n');
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }
  return normalizeNewlines(fs.readFileSync(filePath, 'utf8'));
}

function countOccurrences(source, needle) {
  if (!needle) return 0;
  return source.split(needle).length - 1;
}

function replaceExactCount(source, before, after, expectedCount, label) {
  const count = countOccurrences(source, before);
  if (count !== expectedCount) {
    throw new Error(
      `${label}: expected ${expectedCount} matching source block(s), found ${count}.`
    );
  }
  return source.split(before).join(after);
}

function replaceOnce(source, before, after, label) {
  return replaceExactCount(source, before, after, 1, label);
}

function replaceRegexOnce(source, regex, replacement, label) {
  const flags = regex.flags.replace(/g/g, '');
  const single = new RegExp(regex.source, flags);
  const match = source.match(single);

  if (!match) {
    throw new Error(`${label}: expected source block was not found.`);
  }

  const firstIndex = match.index;
  const remainder = source.slice(firstIndex + match[0].length);
  if (single.test(remainder)) {
    throw new Error(`${label}: expected exactly one source block, found more than one.`);
  }

  return source.slice(0, firstIndex) +
    replacement +
    source.slice(firstIndex + match[0].length);
}

function ensureContains(source, needles, label) {
  for (const needle of needles) {
    if (!source.includes(needle)) {
      throw new Error(`${label}: missing expected contract: ${needle}`);
    }
  }
}

function ensureNotContains(source, needles, label) {
  for (const needle of needles) {
    if (source.includes(needle)) {
      throw new Error(`${label}: stale/forbidden source remains: ${needle}`);
    }
  }
}

function run(command, args, cwd, label) {
  console.log(`\n> ${[command, ...args].join(' ')}`);

  let executable = command;
  let executableArgs = args;

  if (process.platform === 'win32' && command === 'npm') {
    executable = process.env.ComSpec || 'cmd.exe';
    executableArgs = ['/d', '/s', '/c', ['npm', ...args].join(' ')];
  }

  const result = spawnSync(executable, executableArgs, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}.`);
  }
}

function makeBackup(root, originals) {
  const backupRoot = path.join(
    root,
    '.smart-pdm-patch-backup',
    `psa-profile-photo-ui-cleanup-v1-${Date.now()}`
  );

  for (const [filePath, original] of originals.entries()) {
    if (original == null) continue;
    const relative = path.relative(root, filePath);
    const destination = path.join(backupRoot, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, original, 'utf8');
  }

  return backupRoot;
}

function rollback(originals) {
  for (const [filePath, original] of originals.entries()) {
    if (original == null) {
      if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
      continue;
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, original, 'utf8');
  }
}

function buildPsaTerminology(documentVerification, applicationService, documentTypes) {
  if (
    documentVerification.includes(PSA_MARKER) ||
    applicationService.includes(PSA_MARKER) ||
    documentTypes.includes(PSA_MARKER)
  ) {
    throw new Error('PSA / Birth Certificate terminology patch is already present.');
  }

  let nextDocumentVerification = replaceExactCount(
    documentVerification,
    "name: 'Birth Certificate / PSA'",
    "name: 'PSA / Birth Certificate'",
    1,
    'Document Review PSA label'
  );

  nextDocumentVerification = replaceOnce(
    nextDocumentVerification,
    'const REQUIRED_DOCUMENTS = [',
    `// ${PSA_MARKER}\nconst REQUIRED_DOCUMENTS = [`,
    'Document Review PSA marker'
  );

  let nextApplicationService = replaceExactCount(
    applicationService,
    "'Birth Certificate / PSA'",
    "'PSA / Birth Certificate'",
    2,
    'Admin backend canonical PSA labels'
  );

  nextApplicationService = replaceOnce(
    nextApplicationService,
    'const APPLICATION_DOCUMENT_DEFINITIONS = [',
    `// ${PSA_MARKER}\nconst APPLICATION_DOCUMENT_DEFINITIONS = [`,
    'Admin backend PSA marker'
  );

  let nextDocumentTypes = replaceExactCount(
    documentTypes,
    "birth_certificate: 'Birth Certificate / PSA'",
    "birth_certificate: 'PSA / Birth Certificate'",
    1,
    'Canonical document type PSA label'
  );

  nextDocumentTypes = replaceOnce(
    nextDocumentTypes,
    'const DOCUMENT_TYPE_TO_NAME = {',
    `// ${PSA_MARKER}\nconst DOCUMENT_TYPE_TO_NAME = {`,
    'Document type PSA marker'
  );

  // Deliberately preserve all machine identifiers and historical aliases.
  ensureContains(
    nextApplicationService,
    [
      "id: 'birth_certificate'",
      "'birth certificate / psa'",
      "'psa birth certificate'",
      "birth_certificate_psa: 'birth_certificate'",
      "psa_birth_certificate: 'birth_certificate'",
      "psa: 'birth_certificate'",
    ],
    'PSA OCR/document mapping preservation'
  );

  ensureContains(
    nextDocumentTypes,
    [
      "birth_certificate: 'birth_certificate'",
      "birth_certificate_psa: 'birth_certificate'",
      "psa_birth_certificate: 'birth_certificate'",
      "certificate_of_live_birth: 'birth_certificate'",
      "psa: 'birth_certificate'",
      "nso: 'birth_certificate'",
    ],
    'Canonical document alias preservation'
  );

  return {
    documentVerification: nextDocumentVerification,
    applicationService: nextApplicationService,
    documentTypes: nextDocumentTypes,
  };
}

function buildProfilePhotoUi(source) {
  if (!source.includes('SMART-PDM_PROFILE_PHOTO_PENDING_SUPERSEDED_V2')) {
    throw new Error(
      'Profile Photos lifecycle v2 marker was not found. Apply/retain the Pending + Superseded fix before this UI cleanup.'
    );
  }

  if (source.includes(PROFILE_MARKER)) {
    throw new Error('Profile Photos UI cleanup v1 is already present.');
  }

  let next = replaceOnce(
    source,
    '// SMART-PDM_PROFILE_PHOTO_PENDING_SUPERSEDED_V2',
    `// SMART-PDM_PROFILE_PHOTO_PENDING_SUPERSEDED_V2\n// ${PROFILE_MARKER}`,
    'Profile Photos UI marker'
  );

  // Remove an unused duplicate preview component. The actual queue/detail
  // preview continues to use ProfilePhotoPreviewDialog + openPhotoPreview.
  next = replaceRegexOnce(
    next,
    /function ImagePreview\(\{ src, label, primary = false \}\) \{[\s\S]*?\n\}\n\nfunction RejectModal/,
    'function RejectModal',
    'Remove unused ImagePreview component'
  );

  next = replaceOnce(
    next,
    'text-xs font-semibold capitalize ring-1',
    'text-xs font-medium capitalize ring-1',
    'Consistent status pill typography'
  );

  next = replaceOnce(
    next,
    'className="space-y-4 py-3" style={{ background: \'var(--portal-main-bg, #faf7f2)\' }}',
    'className="min-w-0 space-y-4 py-3" style={{ background: \'var(--portal-main-bg, #faf7f2)\' }}',
    'Queue responsive root'
  );

  next = replaceOnce(
    next,
    'className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-stone-100 p-1"',
    'className="grid w-full grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 sm:inline-flex sm:w-auto sm:flex-wrap"',
    'Responsive status filters'
  );

  // Remove the second status pill from Student Information because the
  // review header already shows the status.
  next = replaceOnce(
    next,
    `<div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-stone-900">Student Information</h2>
                        {detail?.status ? <StatusPill status={detail.status} /> : null}
                      </div>`,
    `<h2 className="text-sm font-semibold text-stone-900">Student Information</h2>`,
    'Remove duplicate detail status'
  );

  next = replaceOnce(
    next,
    'className="mt-1 truncate text-xl font-semibold text-stone-900 sm:text-2xl"',
    'className="mt-1 break-words text-lg font-semibold text-stone-900 sm:text-xl"',
    'Responsive detail title'
  );

  next = replaceOnce(
    next,
    'className="flex min-h-[420px] items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:min-h-[500px]"',
    'className="flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 p-3 sm:min-h-[360px] sm:p-4 lg:min-h-[460px]"',
    'Responsive submitted photo stage'
  );

  next = replaceOnce(
    next,
    'className="inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50"',
    'className="inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition hover:bg-stone-50"',
    'Back-to-queue control typography'
  );

  next = replaceOnce(
    next,
    'className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"',
    'className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"',
    'Approve action cleanup'
  );

  next = replaceOnce(
    next,
    'className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"',
    'className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"',
    'Reject action cleanup'
  );

  next = replaceOnce(
    next,
    'className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50"',
    'className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition hover:bg-stone-50"',
    'Desktop Open action typography'
  );

  next = replaceExactCount(
    next,
    'text-[10px] font-semibold uppercase tracking-wide text-emerald-700',
    'text-[10px] font-medium uppercase tracking-wide text-emerald-700',
    2,
    'Current profile badge typography'
  );

  const tableAnchor = `        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="overflow-x-auto">`;

  const responsiveQueue = `        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="divide-y divide-stone-100 md:hidden">
            {loading ? (
              <div className="px-4 py-10 text-center text-sm text-stone-500">
                Loading profile photo reviews...
              </div>
            ) : filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const student = item.student || {};

                return (
                  <article key={item.review_id} className="space-y-3 p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
                        {item.submitted_url ? (
                          <button
                            type="button"
                            onClick={() =>
                              openPhotoPreview(
                                item.submitted_url,
                                \`\${student.display_name || 'Student'} Profile Photo\`
                              )
                            }
                            className="h-full w-full cursor-zoom-in focus:outline-none"
                            aria-label={\`Enlarge \${student.display_name || 'student'} profile photo\`}
                          >
                            <img
                              src={item.submitted_url}
                              alt={\`\${student.display_name || 'Student'} submitted profile\`}
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ) : (
                          <Camera className="h-4 w-4 text-stone-500" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold text-stone-900">
                              {student.display_name || 'Not recorded'}
                            </p>
                            <p className="mt-0.5 text-xs text-stone-500">
                              {student.course_code || 'No course'}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusPill status={item.status} />
                            {item.is_current_profile_photo ? (
                              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                                Current
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <dl className="grid grid-cols-1 gap-2 rounded-xl bg-stone-50 p-3 text-xs sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="font-medium text-stone-500">PDM / Student ID</dt>
                        <dd className="mt-1 break-words text-stone-800">
                          {getStudentCode(student)}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="font-medium text-stone-500">Submitted</dt>
                        <dd className="mt-1 break-words text-stone-800">
                          {formatDate(item.submitted_at)}
                        </dd>
                      </div>
                    </dl>

                    <button
                      type="button"
                      onClick={() => navigate(\`/admin/profile-photos/\${item.review_id}\`)}
                      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
                    >
                      <Eye className="h-4 w-4" />
                      Open Review
                    </button>
                  </article>
                );
              })
            ) : (
              <div className="px-4 py-10 text-center text-sm text-stone-500">
                No {status} profile photo reviews found.
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">`;

  next = replaceRegexOnce(
    next,
    /\s*<div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">\s*\n\s*<div className="overflow-x-auto">/,
    '\n' + responsiveQueue,
    'Responsive queue mobile/desktop split'
  );

  return next;
}

function buildContractTest() {
  return `const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const adminRoot = path.resolve(backendRoot, '..');

const docReview = fs.readFileSync(
  path.join(adminRoot, 'frontend', 'src', 'pages', 'DocumentVerification.jsx'),
  'utf8'
);
const profileQueue = fs.readFileSync(
  path.join(adminRoot, 'frontend', 'src', 'pages', 'ProfilePhotoQueue.jsx'),
  'utf8'
);
const applicationService = fs.readFileSync(
  path.join(backendRoot, 'services', 'applicationService.js'),
  'utf8'
);
const documentTypes = fs.readFileSync(
  path.join(backendRoot, 'utils', 'documentTypes.js'),
  'utf8'
);

test('Review PSA/Birth Certificate requirement wording', () => {
  assert.ok(docReview.includes("name: 'PSA / Birth Certificate'"));
  assert.ok(applicationService.includes("name: 'PSA / Birth Certificate'"));
  assert.ok(documentTypes.includes("birth_certificate: 'PSA / Birth Certificate'"));
});

test('Use consistent PSA / Birth Certificate terminology', () => {
  assert.equal(docReview.includes('Birth Certificate / PSA'), false);
  assert.equal(documentTypes.includes("'Birth Certificate / PSA'"), false);
  assert.equal(applicationService.includes("'Birth Certificate / PSA'"), false);
});

test('Ensure the same requirement name is used in applicant requirements', () => {
  assert.ok(docReview.includes("id: 'birth_certificate'"));
  assert.ok(applicationService.includes("id: 'birth_certificate'"));
  assert.ok(docReview.includes("name: 'PSA / Birth Certificate'"));
  assert.ok(applicationService.includes("name: 'PSA / Birth Certificate'"));
});

test('Ensure web document review displays the correct document type', () => {
  assert.ok(docReview.includes('const REQUIRED_DOCUMENTS = ['));
  assert.ok(docReview.includes("name: 'PSA / Birth Certificate'"));
});

test('Do not break existing PSA OCR/document mapping', () => {
  for (const source of [applicationService, documentTypes]) {
    assert.ok(source.includes("birth_certificate_psa: 'birth_certificate'"));
    assert.ok(source.includes("psa_birth_certificate: 'birth_certificate'"));
    assert.ok(source.includes("psa: 'birth_certificate'"));
    assert.ok(source.includes("nso: 'birth_certificate'"));
  }
  assert.ok(applicationService.includes("'birth certificate / psa'"));
  assert.ok(applicationService.includes("'psa birth certificate'"));
});

test('Clean up Profile Photos page layout', () => {
  assert.ok(profileQueue.includes('${PROFILE_MARKER}'));
  assert.ok(profileQueue.includes('className="min-w-0 space-y-4 py-3"'));
  assert.ok(profileQueue.includes('Open Review'));
});

test('Remove redundant information/actions', () => {
  assert.equal(profileQueue.includes('function ImagePreview'), false);
  const duplicateStudentStatus = '<h2 className="text-sm font-semibold text-stone-900">Student Information</h2>\\n                        {detail?.status ? <StatusPill status={detail.status} /> : null}';
  assert.equal(profileQueue.includes(duplicateStudentStatus), false);
});

test('Make status badges consistent', () => {
  assert.ok(profileQueue.includes('text-xs font-medium capitalize ring-1'));
  assert.ok(profileQueue.includes('text-[10px] font-medium uppercase tracking-wide text-emerald-700'));
});

test('Keep profile-photo preview easy to access', () => {
  assert.ok(profileQueue.includes('ProfilePhotoPreviewDialog'));
  assert.ok(profileQueue.includes('openPhotoPreview('));
  assert.ok(profileQueue.includes('aria-label='));
  assert.ok(profileQueue.includes('Enlarge'));
});

test('Keep approve/reject actions clear', () => {
  assert.ok(profileQueue.includes('Approve Photo'));
  assert.ok(profileQueue.includes('Reject Photo'));
  assert.ok(profileQueue.includes('h-9 w-full'));
  assert.ok(profileQueue.includes('text-xs font-medium'));
});

test('Keep rejection Reason/Remarks workflow', () => {
  assert.ok(profileQueue.includes('Rejection reason'));
  assert.ok(profileQueue.includes('Remarks'));
  assert.ok(profileQueue.includes('onSubmit({ reason, remarks })'));
});

test('Match typography and spacing with other Maintenance modules', () => {
  assert.ok(profileQueue.includes('text-base font-semibold text-stone-900">Profile Photos'));
  assert.ok(profileQueue.includes('text-xs font-medium'));
  assert.ok(profileQueue.includes('rounded-lg'));
});

test('Verify smaller-screen responsiveness', () => {
  assert.ok(profileQueue.includes('grid w-full grid-cols-2'));
  assert.ok(profileQueue.includes('md:hidden'));
  assert.ok(profileQueue.includes('hidden overflow-x-auto md:block'));
  assert.ok(profileQueue.includes('break-words text-lg font-semibold'));
  assert.ok(profileQueue.includes('min-h-[260px]'));
});
`;
}

function validateStaged(files, testSource) {
  ensureContains(
    files.documentVerification,
    [
      PSA_MARKER,
      "id: 'birth_certificate'",
      "name: 'PSA / Birth Certificate'",
    ],
    'PSA web review validation'
  );

  ensureContains(
    files.applicationService,
    [
      PSA_MARKER,
      "name: 'PSA / Birth Certificate'",
      "birth_certificate: 'PSA / Birth Certificate'",
      "'birth certificate / psa'",
    ],
    'PSA backend validation'
  );

  ensureContains(
    files.documentTypes,
    [
      PSA_MARKER,
      "birth_certificate: 'PSA / Birth Certificate'",
      "psa_birth_certificate: 'birth_certificate'",
    ],
    'PSA document type validation'
  );

  ensureContains(
    files.profileQueue,
    [
      PROFILE_MARKER,
      'grid w-full grid-cols-2',
      'md:hidden',
      'hidden overflow-x-auto md:block',
      'Open Review',
      'Approve Photo',
      'Reject Photo',
      'Rejection reason',
      'Remarks',
      'ProfilePhotoPreviewDialog',
    ],
    'Profile Photos UI validation'
  );

  ensureNotContains(
    files.profileQueue,
    ['function ImagePreview'],
    'Profile Photos redundant component validation'
  );

  ensureContains(
    testSource,
    [
      'Review PSA/Birth Certificate requirement wording',
      'Use consistent PSA / Birth Certificate terminology',
      'Ensure the same requirement name is used in applicant requirements',
      'Ensure web document review displays the correct document type',
      'Do not break existing PSA OCR/document mapping',
      'Clean up Profile Photos page layout',
      'Remove redundant information/actions',
      'Make status badges consistent',
      'Keep profile-photo preview easy to access',
      'Keep approve/reject actions clear',
      'Keep rejection Reason/Remarks workflow',
      'Match typography and spacing with other Maintenance modules',
      'Verify smaller-screen responsiveness',
    ],
    'Trello checklist test validation'
  );
}

function main() {
  const { dryRun, root } = parseArgs(process.argv.slice(2));

  const documentVerificationFile = path.join(
    root,
    'admin',
    'frontend',
    'src',
    'pages',
    'DocumentVerification.jsx'
  );
  const profileQueueFile = path.join(
    root,
    'admin',
    'frontend',
    'src',
    'pages',
    'ProfilePhotoQueue.jsx'
  );
  const applicationServiceFile = path.join(
    root,
    'admin',
    'backend',
    'services',
    'applicationService.js'
  );
  const documentTypesFile = path.join(
    root,
    'admin',
    'backend',
    'utils',
    'documentTypes.js'
  );
  const testFile = path.join(
    root,
    'admin',
    'backend',
    'test',
    'psa-profile-photo-ui-contract.test.js'
  );

  console.log(PATCH_NAME);
  console.log(`Repository: ${root}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}\n`);

  const originalDocumentVerification = readRequired(documentVerificationFile);
  const originalProfileQueue = readRequired(profileQueueFile);
  const originalApplicationService = readRequired(applicationServiceFile);
  const originalDocumentTypes = readRequired(documentTypesFile);
  const originalTest = fs.existsSync(testFile)
    ? normalizeNewlines(fs.readFileSync(testFile, 'utf8'))
    : null;

  console.log('[1/5] Standardizing PSA / Birth Certificate wording...');
  const psa = buildPsaTerminology(
    originalDocumentVerification,
    originalApplicationService,
    originalDocumentTypes
  );
  console.log('      PASS');

  console.log('[2/5] Preserving PSA OCR/document aliases and machine mapping...');
  ensureContains(
    psa.applicationService,
    [
      "birth_certificate_psa: 'birth_certificate'",
      "psa_birth_certificate: 'birth_certificate'",
      "'birth certificate / psa'",
    ],
    'PSA mapping safety'
  );
  console.log('      PASS');

  console.log('[3/5] Cleaning Profile Photos layout + redundant UI...');
  const stagedProfileQueue = buildProfilePhotoUi(originalProfileQueue);
  console.log('      PASS');

  console.log('[4/5] Building responsive Profile Photos queue/detail behavior...');
  ensureContains(
    stagedProfileQueue,
    [
      'md:hidden',
      'hidden overflow-x-auto md:block',
      'grid w-full grid-cols-2',
      'min-h-[260px]',
    ],
    'Responsive Profile Photos'
  );
  console.log('      PASS');

  console.log('[5/5] Building Trello checklist regression tests...');
  const stagedTest = buildContractTest();
  const stagedFiles = {
    documentVerification: psa.documentVerification,
    profileQueue: stagedProfileQueue,
    applicationService: psa.applicationService,
    documentTypes: psa.documentTypes,
  };
  validateStaged(stagedFiles, stagedTest);
  console.log('      PASS');

  if (dryRun) {
    console.log('\nPASS: dry-run completed. No files were changed.');
    return;
  }

  const originals = new Map([
    [documentVerificationFile, originalDocumentVerification],
    [profileQueueFile, originalProfileQueue],
    [applicationServiceFile, originalApplicationService],
    [documentTypesFile, originalDocumentTypes],
    [testFile, originalTest],
  ]);

  const backupRoot = makeBackup(root, originals);
  let wrote = false;

  try {
    fs.writeFileSync(documentVerificationFile, psa.documentVerification, 'utf8');
    fs.writeFileSync(profileQueueFile, stagedProfileQueue, 'utf8');
    fs.writeFileSync(applicationServiceFile, psa.applicationService, 'utf8');
    fs.writeFileSync(documentTypesFile, psa.documentTypes, 'utf8');
    fs.mkdirSync(path.dirname(testFile), { recursive: true });
    fs.writeFileSync(testFile, stagedTest, 'utf8');
    wrote = true;

    run(
      process.execPath,
      ['--check', applicationServiceFile],
      root,
      'Application service syntax validation'
    );

    run(
      process.execPath,
      ['--check', documentTypesFile],
      root,
      'Document type syntax validation'
    );

    run(
      process.execPath,
      ['--test', testFile],
      path.join(root, 'admin', 'backend'),
      'PSA + Profile Photos checklist tests'
    );

    run(
      'npm',
      ['run', 'build'],
      path.join(root, 'admin', 'frontend'),
      'Admin frontend production build'
    );

    console.log('\nPASS: PSA terminology + Profile Photos UI/workflow cleanup + frontend build passed.');

    console.log('\nTrello checklist verified:');
    console.log('  [x] Review PSA/Birth Certificate requirement wording');
    console.log('  [x] Use consistent "PSA / Birth Certificate" terminology');
    console.log('  [x] Ensure the same requirement name is used in applicant requirements');
    console.log('  [x] Ensure web document review displays the correct document type');
    console.log('  [x] Do not break existing PSA OCR/document mapping');
    console.log('');
    console.log('  [x] Clean up Profile Photos page layout');
    console.log('  [x] Remove redundant information/actions');
    console.log('  [x] Make status badges consistent');
    console.log('  [x] Keep profile-photo preview easy to access');
    console.log('  [x] Keep approve/reject actions clear');
    console.log('  [x] Keep rejection Reason/Remarks workflow');
    console.log('  [x] Match typography and spacing with other Maintenance modules');
    console.log('  [x] Verify smaller-screen responsiveness');
    console.log(`\nBackup: ${backupRoot}`);
  } catch (error) {
    if (wrote) {
      console.error('\nPatch verification failed. Restoring previous files...');
      rollback(originals);
      console.error(`Rollback completed. Backup: ${backupRoot}`);
    }
    throw error;
  }
}

try {
  main();
} catch (error) {
  console.error(`\nFAIL: ${error.message}`);
  process.exitCode = 1;
}
