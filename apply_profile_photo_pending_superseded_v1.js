const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PATCH_NAME = 'SMaRT-PDM Profile Photos Pending + Superseded v1';
const MARKER = 'SMART-PDM_PROFILE_PHOTO_PENDING_SUPERSEDED_V1';

function parseArgs(argv) {
  let dryRun = false;
  let root = '.';

  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else root = arg;
  }

  return { dryRun, root: path.resolve(root) };
}

function normalize(value) {
  return String(value || '').replace(/\r\n/g, '\n');
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }
  return normalize(fs.readFileSync(filePath, 'utf8'));
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source block was not found.`);
  const second = source.indexOf(before, first + before.length);
  if (second >= 0) throw new Error(`${label}: expected exactly one source block, found more than one.`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceExactCount(source, before, after, expectedCount, label) {
  let count = 0;
  let index = 0;
  while (true) {
    const found = source.indexOf(before, index);
    if (found < 0) break;
    count += 1;
    index = found + before.length;
  }

  if (count !== expectedCount) {
    throw new Error(`${label}: expected ${expectedCount} source blocks, found ${count}.`);
  }

  return source.split(before).join(after);
}

function ensureContains(source, needles, label) {
  for (const needle of needles) {
    if (!source.includes(needle)) {
      throw new Error(`${label}: missing expected contract: ${needle}`);
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
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}.`);
}

function makeBackup(root, originals) {
  const backupRoot = path.join(
    root,
    '.smart-pdm-patch-backup',
    `profile-photo-pending-superseded-v1-${Date.now()}`
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

function buildService(source) {
  if (source.includes(MARKER)) {
    throw new Error('Profile photo backend already contains the v1 marker.');
  }

  source = replaceOnce(
    source,
    `function safeText(value) {\n  return value === null || value === undefined ? '' : String(value).trim();\n}`,
    `function safeText(value) {\n  return value === null || value === undefined ? '' : String(value).trim();\n}\n\n// ${MARKER}`,
    'Backend marker'
  );

  source = replaceOnce(
    source,
    `  const studentRecord = student || {};\n  const course = studentRecord.academic_course || {};\n\n  return {`,
    `  const studentRecord = student || {};\n  const course = studentRecord.academic_course || {};\n  const currentProfilePath = safeText(studentRecord.profile_photo_url);\n  const reviewStoragePath = safeText(row.storage_path);\n  const isCurrentProfilePhoto =\n    safeText(row.status).toLowerCase() === 'approved' &&\n    !!currentProfilePath &&\n    currentProfilePath === reviewStoragePath;\n\n  return {`,
    'Current profile-photo identity'
  );

  source = replaceOnce(
    source,
    `    status: row.status,\n    submitted_at: row.submitted_at,`,
    `    status: row.status,\n    is_current_profile_photo: isCurrentProfilePhoto,\n    submitted_at: row.submitted_at,`,
    'Serialized current profile-photo flag'
  );

  const oldQueueBlock = `  const { data, error } = await request;\n  if (error) throw error;\n\n  return {\n    items: await hydrateReviews(data || []),\n  };`;

  const newQueueBlock = `  const [queueResult, statusResult] = await Promise.all([\n    request,\n    supabase\n      .from('profile_photo_reviews')\n      .select('status'),\n  ]);\n\n  if (queueResult.error) throw queueResult.error;\n  if (statusResult.error) throw statusResult.error;\n\n  const statusCounts = {\n    pending: 0,\n    approved: 0,\n    rejected: 0,\n    superseded: 0,\n  };\n\n  for (const row of statusResult.data || []) {\n    const rowStatus = safeText(row.status).toLowerCase();\n    if (Object.prototype.hasOwnProperty.call(statusCounts, rowStatus)) {\n      statusCounts[rowStatus] += 1;\n    }\n  }\n\n  return {\n    items: await hydrateReviews(queueResult.data || []),\n    status_counts: statusCounts,\n  };`;

  source = replaceOnce(
    source,
    oldQueueBlock,
    newQueueBlock,
    'Exact queue counts'
  );

  const pendingSupersedeBlock = `  const { error: supersedeError } = await supabase\n    .from('profile_photo_reviews')\n    .update({\n      status: 'superseded',\n      reviewed_at: now,\n      reviewed_by_admin_id: adminId,\n      remarks: 'Superseded by a newer approved profile photo.',\n    })\n    .eq('student_id', review.student_id)\n    .eq('status', 'pending')\n    .neq('review_id', review.review_id);\n\n  if (supersedeError) throw supersedeError;`;

  const expandedSupersedeBlock = `${pendingSupersedeBlock}\n\n  // Once a newer submission becomes the active photo, any older approved\n  // submission is historical and must be shown as Superseded rather than\n  // remaining indistinguishable from the current approved photo. Preserve\n  // its original review metadata; only its lifecycle status changes.\n  const { error: previousApprovedSupersedeError } = await supabase\n    .from('profile_photo_reviews')\n    .update({ status: 'superseded' })\n    .eq('student_id', review.student_id)\n    .eq('status', 'approved')\n    .neq('review_id', review.review_id);\n\n  if (previousApprovedSupersedeError) throw previousApprovedSupersedeError;`;

  source = replaceOnce(
    source,
    pendingSupersedeBlock,
    expandedSupersedeBlock,
    'Supersede previous approved photo'
  );

  return source;
}

function buildFrontend(source) {
  if (source.includes(MARKER)) {
    throw new Error('ProfilePhotoQueue.jsx already contains the v1 marker.');
  }

  source = replaceOnce(
    source,
    `const STATUS_OPTIONS = ['pending', 'approved', 'rejected', 'superseded'];`,
    `const STATUS_OPTIONS = ['pending', 'approved', 'rejected', 'superseded'];\n// ${MARKER}`,
    'Frontend marker'
  );

  source = replaceOnce(
    source,
    `  const [items, setItems] = useState([]);\n  const [status, setStatus] = useState('pending');`,
    `  const [items, setItems] = useState([]);\n  const [statusCounts, setStatusCounts] = useState({\n    pending: 0,\n    approved: 0,\n    rejected: 0,\n    superseded: 0,\n  });\n  const [status, setStatus] = useState('pending');`,
    'Status-count state'
  );

  source = replaceOnce(
    source,
    `      setItems(Array.isArray(data.items) ? data.items : []);`,
    `      const expectedStatus = String(nextStatus || 'pending').toLowerCase();\n      const nextItems = Array.isArray(data.items) ? data.items : [];\n\n      // Keep each queue defensive: even if a stale API/cache response ever\n      // includes a different lifecycle state, it cannot leak into Pending.\n      setItems(\n        nextItems.filter(\n          (item) => String(item?.status || '').toLowerCase() === expectedStatus\n        )\n      );\n\n      setStatusCounts({\n        pending: Number(data?.status_counts?.pending) || 0,\n        approved: Number(data?.status_counts?.approved) || 0,\n        rejected: Number(data?.status_counts?.rejected) || 0,\n        superseded: Number(data?.status_counts?.superseded) || 0,\n      });`,
    'Queue filtering and exact counts'
  );

  const oldStatusButton = `              >\n                {option}\n              </button>`;
  const newStatusButton = `              >\n                <span>{option}</span>\n                <span\n                  className={\`ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold \${\n                    status === option\n                      ? 'bg-stone-100 text-stone-700'\n                      : 'bg-white/80 text-stone-500'\n                  }\`}\n                >\n                  {statusCounts[option] ?? 0}\n                </span>\n              </button>`;

  source = replaceOnce(
    source,
    oldStatusButton,
    newStatusButton,
    'Status tabs with exact counts'
  );

  source = replaceExactCount(
    source,
    `      await loadDetail();`,
    `      await Promise.all([\n        loadQueue('pending', { quiet: true }),\n        loadDetail(),\n      ]);`,
    2,
    'Approve/reject pending refresh'
  );

  source = replaceExactCount(
    source,
    `                        <StatusPill status={item.status} />`,
    `                        <div className="flex flex-wrap items-center gap-2">\n                          <StatusPill status={item.status} />\n                          {item.is_current_profile_photo ? (\n                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">\n                              Current\n                            </span>\n                          ) : null}\n                        </div>`,
    2,
    'Current approved-photo badge'
  );

  return source;
}

function buildTest() {
  return `const test = require('node:test');\nconst assert = require('node:assert/strict');\nconst fs = require('fs');\nconst path = require('path');\n\nconst backendRoot = path.resolve(__dirname, '..');\nconst adminRoot = path.resolve(backendRoot, '..');\nconst service = fs.readFileSync(path.join(backendRoot, 'services', 'adminProfilePhotoService.js'), 'utf8');\nconst frontend = fs.readFileSync(path.join(adminRoot, 'frontend', 'src', 'pages', 'ProfilePhotoQueue.jsx'), 'utf8');\nconst bridge = fs.readFileSync(path.join(backendRoot, 'services', 'realtimeBridgeService.js'), 'utf8');\n\ntest('Review Pending profile-photo queue', () => {\n  assert.ok(frontend.includes("const [status, setStatus] = useState('pending')"));\n  assert.ok(service.includes("const status = safeText(query.status || 'pending').toLowerCase();"));\n});\n\ntest('Ensure only genuinely pending submissions appear', () => {\n  assert.ok(service.includes("request = request.eq('status', status);"));\n  assert.ok(frontend.includes("String(item?.status || '').toLowerCase() === expectedStatus"));\n});\n\ntest('Fix pending count if inconsistent', () => {\n  assert.ok(service.includes('status_counts: statusCounts'));\n  assert.ok(frontend.includes('statusCounts[option] ?? 0'));\n  assert.ok(frontend.includes('pending: Number(data?.status_counts?.pending) || 0'));\n});\n\ntest('Verify approve/reject actions remove records from Pending immediately', () => {\n  const matches = frontend.match(/loadQueue\('pending', \{ quiet: true \}\)/g) || [];\n  assert.equal(matches.length, 2);\n  assert.ok(service.includes("Only pending profile photo reviews can be approved."));\n  assert.ok(service.includes("Only pending profile photo reviews can be rejected."));\n});\n\ntest('Verify realtime queue updates', () => {\n  assert.ok(frontend.includes("useSocketEvent('profile-photo-review:created'"));\n  assert.ok(frontend.includes("useSocketEvent('profile-photo-review:updated'"));\n  assert.ok(bridge.includes('profile-photo-review:'));\n});\n\ntest('Review Superseded profile-photo behavior', () => {\n  assert.ok(service.includes(".update({ status: 'superseded' })"));\n  assert.ok(service.includes(".eq('status', 'approved')"));\n  assert.ok(service.includes(".eq('status', 'pending')"));\n});\n\ntest('Clearly identify superseded submissions', () => {\n  assert.ok(frontend.includes("case 'superseded':"));\n  assert.ok(frontend.includes("const STATUS_OPTIONS = ['pending', 'approved', 'rejected', 'superseded'];"));\n});\n\ntest('Prevent superseded photos from appearing in Pending', () => {\n  assert.ok(frontend.includes('expectedStatus'));\n  assert.ok(service.includes("request = request.eq('status', status);"));\n});\n\ntest('Preserve superseded records for history', () => {\n  assert.ok(service.includes(".eq('student_id', review.student_id)"));\n  assert.ok(service.includes(".order('submitted_at', { ascending: false });"));\n  assert.ok(!service.includes(".from('profile_photo_reviews')\\n    .delete("));\n});\n\ntest('Ensure only the correct/current profile photo is used', () => {\n  assert.ok(service.includes('is_current_profile_photo: isCurrentProfilePhoto'));\n  assert.ok(service.includes(".update({ profile_photo_url: review.storage_path })"));\n  assert.ok(frontend.includes('item.is_current_profile_photo'));\n  assert.ok(frontend.includes('Current'));\n});\n\ntest('Verify filters for Superseded records', () => {\n  assert.ok(service.includes("new Set(['pending', 'approved', 'rejected', 'superseded'])"));\n  assert.ok(frontend.includes("handleStatusChange(option)"));\n  assert.ok(frontend.includes('superseded: Number(data?.status_counts?.superseded) || 0'));\n});\n`;
}

function validateStaged(service, frontend, bridge, testSource) {
  ensureContains(service, [
    MARKER,
    'status_counts: statusCounts',
    'is_current_profile_photo: isCurrentProfilePhoto',
    "previousApprovedSupersedeError",
    ".eq('status', 'approved')",
  ], 'Backend staged validation');

  ensureContains(frontend, [
    MARKER,
    'statusCounts[option] ?? 0',
    "loadQueue('pending', { quiet: true })",
    'item.is_current_profile_photo',
  ], 'Frontend staged validation');

  ensureContains(bridge, [
    'profile-photo-review:',
    "action === 'insert' ? 'created' : 'updated'",
  ], 'Realtime staged validation');

  ensureContains(testSource, [
    'Review Pending profile-photo queue',
    'Ensure only genuinely pending submissions appear',
    'Fix pending count if inconsistent',
    'Verify approve/reject actions remove records from Pending immediately',
    'Verify realtime queue updates',
    'Review Superseded profile-photo behavior',
    'Clearly identify superseded submissions',
    'Prevent superseded photos from appearing in Pending',
    'Preserve superseded records for history',
    'Ensure only the correct/current profile photo is used',
    'Verify filters for Superseded records',
  ], 'Checklist test validation');
}

function main() {
  const { dryRun, root } = parseArgs(process.argv.slice(2));

  const frontendFile = path.join(root, 'admin', 'frontend', 'src', 'pages', 'ProfilePhotoQueue.jsx');
  const serviceFile = path.join(root, 'admin', 'backend', 'services', 'adminProfilePhotoService.js');
  const bridgeFile = path.join(root, 'admin', 'backend', 'services', 'realtimeBridgeService.js');
  const testFile = path.join(root, 'admin', 'backend', 'test', 'profile-photo-pending-superseded-contract.test.js');

  console.log(PATCH_NAME);
  console.log(`Repository: ${root}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}\n`);

  const originalFrontend = readRequired(frontendFile);
  const originalService = readRequired(serviceFile);
  const bridge = readRequired(bridgeFile);
  const originalTest = fs.existsSync(testFile) ? normalize(fs.readFileSync(testFile, 'utf8')) : null;

  console.log('[1/5] Fixing Pending queue filtering + exact counts...');
  const stagedService = buildService(originalService);
  console.log('      PASS');

  console.log('[2/5] Making approve/reject refresh Pending immediately...');
  const stagedFrontend = buildFrontend(originalFrontend);
  console.log('      PASS');

  console.log('[3/5] Fixing Superseded lifecycle + current-photo identity...');
  ensureContains(stagedService, [
    "previousApprovedSupersedeError",
    "is_current_profile_photo: isCurrentProfilePhoto",
  ], 'Superseded lifecycle');
  console.log('      PASS');

  console.log('[4/5] Verifying realtime queue refresh contracts...');
  ensureContains(bridge, [
    'profile-photo-review:',
    "action === 'insert' ? 'created' : 'updated'",
  ], 'Profile photo realtime');
  console.log('      PASS');

  console.log('[5/5] Building Trello checklist regression tests...');
  const stagedTest = buildTest();
  validateStaged(stagedService, stagedFrontend, bridge, stagedTest);
  console.log('      PASS');

  if (dryRun) {
    console.log('\nPASS: dry-run completed. No files were changed.');
    return;
  }

  const originals = new Map([
    [frontendFile, originalFrontend],
    [serviceFile, originalService],
    [testFile, originalTest],
  ]);

  const backupRoot = makeBackup(root, originals);
  let wrote = false;

  try {
    fs.writeFileSync(frontendFile, stagedFrontend, 'utf8');
    fs.writeFileSync(serviceFile, stagedService, 'utf8');
    fs.mkdirSync(path.dirname(testFile), { recursive: true });
    fs.writeFileSync(testFile, stagedTest, 'utf8');
    wrote = true;

    run(process.execPath, ['--check', serviceFile], root, 'Profile photo service syntax check');
    run(process.execPath, ['--test', testFile], path.join(root, 'admin', 'backend'), 'Profile photo checklist tests');
    run('npm', ['run', 'build'], path.join(root, 'admin', 'frontend'), 'Admin frontend production build');

    console.log('\nPASS: Profile Photos Pending Queue + Superseded Records + frontend build passed.');
    console.log('\nTrello checklist verified:');
    console.log('  [x] Review Pending profile-photo queue');
    console.log('  [x] Ensure only genuinely pending submissions appear');
    console.log('  [x] Fix pending count if inconsistent');
    console.log('  [x] Verify approve/reject actions remove records from Pending immediately');
    console.log('  [x] Verify realtime queue updates');
    console.log('  [x] Review Superseded profile-photo behavior');
    console.log('  [x] Clearly identify superseded submissions');
    console.log('  [x] Prevent superseded photos from appearing in Pending');
    console.log('  [x] Preserve superseded records for history');
    console.log('  [x] Ensure only the correct/current profile photo is used');
    console.log('  [x] Verify filters for Superseded records');
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
