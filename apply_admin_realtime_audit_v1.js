#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function findRepo(start) {
  let dir = path.resolve(start);

  while (true) {
    const marker = path.join(
      dir,
      'admin',
      'backend',
      'services',
      'realtimeBridgeService.js'
    );

    if (fs.existsSync(marker)) return dir;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    'Could not find SMaRT-PDM repo root. Run this from D:\\projects\\SMaRT-PDM.'
  );
}

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}`);

  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) throw result.error;

  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}.`);
  }
}

function readNormalized(file) {
  const original = fs.readFileSync(file, 'utf8');
  return {
    file,
    original,
    useCrlf: original.includes('\r\n'),
    source: original.replace(/\r\n/g, '\n'),
  };
}

function writeNormalized(state) {
  fs.writeFileSync(
    state.file,
    state.useCrlf ? state.source.replace(/\n/g, '\r\n') : state.source,
    'utf8'
  );
}

function replaceOnce(state, before, after, label, appliedMarker = null) {
  if (appliedMarker && state.source.includes(appliedMarker)) {
    return;
  }

  if (!state.source.includes(before)) {
    throw new Error(
      `Preflight failed: ${label} source block was not found. No project files were written.`
    );
  }

  state.source = state.source.replace(before, after);
}

function removeUseSocketEvent(state, eventName, label) {
  const marker = `useSocketEvent('${eventName}'`;
  const markerIndex = state.source.indexOf(marker);

  if (markerIndex < 0) return;

  const openParen = state.source.indexOf('(', markerIndex);
  if (openParen < 0) {
    throw new Error(`Preflight failed: ${label} opening parenthesis was not found. No project files were written.`);
  }

  let depth = 0;
  let end = -1;

  for (let i = openParen; i < state.source.length; i += 1) {
    const char = state.source[i];
    if (char === '(') depth += 1;
    if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end < 0) {
    throw new Error(`Preflight failed: ${label} closing parenthesis was not found. No project files were written.`);
  }

  if (state.source[end] === ';') end += 1;

  const lineStart = state.source.lastIndexOf('\n', markerIndex) + 1;

  // Remove the hook line/block plus at most one following blank line. This
  // keeps surrounding JSX/JS formatting stable without depending on CRLF/LF.
  if (state.source.slice(end, end + 2) === '\n\n') {
    end += 2;
  } else if (state.source[end] === '\n') {
    end += 1;
  }

  state.source = state.source.slice(0, lineStart) + state.source.slice(end);
}

function requireMarker(source, marker, label) {
  if (!source.includes(marker)) {
    throw new Error(
      `Preflight failed: ${label} is missing. No project files were written.`
    );
  }
}

function count(source, needle) {
  if (!needle) return 0;
  return source.split(needle).length - 1;
}

const repo = findRepo(process.cwd());
const adminFrontend = path.join(repo, 'admin', 'frontend');
const adminBackend = path.join(repo, 'admin', 'backend');

const files = {
  roController: readNormalized(
    path.join(adminBackend, 'controllers', 'roController.js')
  ),
  endorsementQueue: readNormalized(
    path.join(adminFrontend, 'src', 'pages', 'EndorsementQueue.jsx')
  ),
  profilePhotoQueue: readNormalized(
    path.join(adminFrontend, 'src', 'pages', 'ProfilePhotoQueue.jsx')
  ),
  payoutManagement: readNormalized(
    path.join(adminFrontend, 'src', 'pages', 'PayoutManagement.jsx')
  ),
  adminDashboard: readNormalized(
    path.join(adminFrontend, 'src', 'pages', 'AdminDashboard.jsx')
  ),
  reportGeneration: readNormalized(
    path.join(adminFrontend, 'src', 'pages', 'ReportGeneration.jsx')
  ),
};

// Audit-only files: these are not modified, but must still prove the requested
// realtime paths exist before this installer writes anything.
const auditSources = {
  realtimeBridge: fs
    .readFileSync(path.join(adminBackend, 'services', 'realtimeBridgeService.js'), 'utf8')
    .replace(/\r\n/g, '\n'),
  openingApplications: fs
    .readFileSync(path.join(adminFrontend, 'src', 'pages', 'OpeningApplications.jsx'), 'utf8')
    .replace(/\r\n/g, '\n'),
  accountsPanel: fs
    .readFileSync(path.join(adminFrontend, 'src', 'pages', 'maintenance', 'AccountsPanel.jsx'), 'utf8')
    .replace(/\r\n/g, '\n'),
  accountController: fs
    .readFileSync(path.join(adminBackend, 'controllers', 'accountController.js'), 'utf8')
    .replace(/\r\n/g, '\n'),
  scholarMonitoring: fs
    .readFileSync(path.join(adminFrontend, 'src', 'pages', 'ScholarMonitoring.jsx'), 'utf8')
    .replace(/\r\n/g, '\n'),
  socketHook: fs
    .readFileSync(path.join(adminFrontend, 'src', 'hooks', 'useSocket.js'), 'utf8')
    .replace(/\r\n/g, '\n'),
  payoutController: fs
    .readFileSync(path.join(adminBackend, 'controllers', 'payoutController.js'), 'utf8')
    .replace(/\r\n/g, '\n'),
  internalRealtimeRoutes: fs
    .readFileSync(path.join(adminBackend, 'routes', 'internalRealtimeRoutes.js'), 'utf8')
    .replace(/\r\n/g, '\n'),
  mobileRoController: fs
    .readFileSync(path.join(repo, 'mobile', 'backend', 'src', 'controllers', 'roController.js'), 'utf8')
    .replace(/\r\n/g, '\n'),
  mobileRealtimeRelay: fs
    .readFileSync(path.join(repo, 'mobile', 'backend', 'src', 'services', 'adminRealtimeRelayService.js'), 'utf8')
    .replace(/\r\n/g, '\n'),
};

console.log('SMaRT-PDM Admin Realtime Audit v1');
console.log(`Repository: ${repo}`);

console.log('\n[1/9] Auditing Applications realtime...');
for (const [source, marker, label] of [
  [auditSources.realtimeBridge, "table: 'applications'", 'applications Supabase realtime binding'],
  [auditSources.realtimeBridge, "emitPublic(io, 'application:updated'", 'application:updated bridge event'],
  [auditSources.openingApplications, "useSocketEvent('application:updated'", 'opening applicant realtime listener'],
]) {
  requireMarker(source, marker, label);
}
console.log('      PASS');

console.log('[2/9] Auditing FCFS realtime...');
for (const [marker, label] of [
  ['queue_position', 'FCFS queue position field'],
  ['fcfs_completed_at', 'FCFS completion field'],
  ["useSocketEvent('application:updated'", 'FCFS refresh through application:updated'],
]) {
  requireMarker(auditSources.openingApplications, marker, label);
}
console.log('      PASS');

console.log('[3/9] Auditing Endorsement realtime and removing aggressive polling...');
requireMarker(auditSources.realtimeBridge, "table: 'endorsement_slips'", 'endorsement_slips realtime binding');
requireMarker(files.endorsementQueue.source, "useSocketEvent('endorsement:updated'", 'endorsement queue listener');
replaceOnce(
  files.endorsementQueue,
  `  useEffect(() => {\n    if (!hasAccess) return undefined;\n    const id = window.setInterval(() => loadQueue({ soft: true }), 8000);\n    return () => window.clearInterval(id);\n  }, [hasAccess, loadQueue]);`,
  `  useEffect(() => {\n    if (!hasAccess) return undefined;\n\n    // Socket events are the primary refresh path. This low-frequency fallback\n    // only repairs a temporarily missed event while the tab is visible.\n    const FALLBACK_REFRESH_INTERVAL_MS = 2 * 60 * 1000;\n\n    const refreshIfVisible = () => {\n      if (document.visibilityState !== 'visible') return;\n      loadQueue({ soft: true });\n    };\n\n    const id = window.setInterval(\n      refreshIfVisible,\n      FALLBACK_REFRESH_INTERVAL_MS\n    );\n\n    return () => window.clearInterval(id);\n  }, [hasAccess, loadQueue]);`,
  'EndorsementQueue 8-second polling cleanup',
  'FALLBACK_REFRESH_INTERVAL_MS = 2 * 60 * 1000'
);
console.log('      PASS');

console.log('[4/9] Auditing Profile Photo realtime and removing dead listeners...');
requireMarker(auditSources.realtimeBridge, "table: 'profile_photo_reviews'", 'profile photo realtime binding');
requireMarker(files.profilePhotoQueue.source, "useSocketEvent('profile-photo-review:created'", 'profile photo created listener');
requireMarker(files.profilePhotoQueue.source, "useSocketEvent('profile-photo-review:updated'", 'profile photo updated listener');
removeUseSocketEvent(
  files.profilePhotoQueue,
  'profile-photo-review:approved',
  'unused profile-photo-review:approved listener'
);
removeUseSocketEvent(
  files.profilePhotoQueue,
  'profile-photo-review:rejected',
  'unused profile-photo-review:rejected listener'
);
console.log('      PASS');

console.log('[5/9] Auditing Accounts realtime...');
requireMarker(auditSources.accountsPanel, "useSocketEvent(\n        'maintenance:updated'", 'AccountsPanel maintenance listener');
requireMarker(auditSources.accountController, 'socketEvents.maintenanceUpdated(io, payload)', 'account controller maintenance event');
console.log('      PASS');

console.log('[6/9] Auditing Payout realtime and removing duplicate refresh paths...');
for (const marker of [
  'emitPayoutBatchRealtime',
  'emitPayoutEntryRealtime',
  "socketEvents.payoutUpdated(io, payload)",
]) {
  requireMarker(auditSources.payoutController, marker, `payout realtime marker ${marker}`);
}
requireMarker(files.payoutManagement.source, "useSocketEvent('payout:created'", 'payout created listener');
requireMarker(files.payoutManagement.source, "useSocketEvent('payout:updated'", 'payout updated listener');

removeUseSocketEvent(
  files.payoutManagement,
  'payout:archived',
  'duplicate PayoutManagement payout:archived listener'
);
removeUseSocketEvent(
  files.payoutManagement,
  'payout:restored',
  'duplicate PayoutManagement payout:restored listener'
);
removeUseSocketEvent(
  files.payoutManagement,
  'scholar:released',
  'duplicate PayoutManagement scholar:released listener'
);

for (const eventName of ['payout:archived', 'payout:restored', 'scholar:released']) {
  removeUseSocketEvent(
    files.adminDashboard,
    eventName,
    `duplicate AdminDashboard ${eventName} listener`
  );
}

for (const eventName of ['payout:created', 'payout:updated', 'payout:archived', 'payout:restored']) {
  removeUseSocketEvent(
    files.reportGeneration,
    eventName,
    `duplicate ReportGeneration ${eventName} listener`
  );
}
requireMarker(files.reportGeneration.source, "useSocketEvent('report:updated'", 'report:updated canonical listener');
console.log('      PASS');

console.log('[7/9] Auditing RO realtime and removing duplicate canonical emits...');
requireMarker(auditSources.internalRealtimeRoutes, "router.post('/ro-updated'", 'admin mobile RO relay endpoint');
requireMarker(auditSources.mobileRealtimeRelay, 'relayRoUpdated', 'mobile-to-admin RO relay service');
requireMarker(auditSources.mobileRoController, 'relayRoUpdated', 'mobile RO controller relay usage');

replaceOnce(
  files.roController,
  `    if (typeof socketEvents?.roUpdated === 'function') {\n      socketEvents.roUpdated(io, data);\n    } else if (typeof socketEvents?.emitEvent === 'function') {\n      socketEvents.emitEvent(io, 'ro:updated', data);\n      socketEvents.emitEvent(io, 'roUpdated', data);\n    } else {\n      io.emit('ro:updated', data);\n      io.emit('roUpdated', data);\n    }\n\n    io.emit('ro:updated', data);\n    io.emit('roUpdated', data);`,
  `    if (typeof socketEvents?.roUpdated === 'function') {\n      socketEvents.roUpdated(io, data);\n    } else if (typeof socketEvents?.emitEvent === 'function') {\n      socketEvents.emitEvent(io, 'ro:updated', data);\n    } else {\n      io.emit('ro:updated', data);\n    }\n\n    // Keep the legacy alias once for older clients while the canonical\n    // ro:updated event remains the single web refresh signal.\n    io.emit('roUpdated', data);`,
  'duplicate RO canonical emit block',
  'Keep the legacy alias once for older clients'
);
console.log('      PASS');

console.log('[8/9] Auditing Renewal realtime...');
for (const marker of ["table: 'renewals'", "table: 'renewal_documents'", "emitPublic(io, 'renewal:updated'"]) {
  requireMarker(auditSources.realtimeBridge, marker, `renewal realtime marker ${marker}`);
}
requireMarker(auditSources.scholarMonitoring, "useSocketEvent(\n    'renewal:updated'", 'ScholarMonitoring renewal listener');
console.log('      PASS');

console.log('[9/9] Auditing socket listener lifecycle...');
requireMarker(auditSources.socketHook, 'let globalSocket = null;', 'single global socket');
requireMarker(auditSources.socketHook, 'socket.off(event, handler);', 'exact socket event cleanup');
requireMarker(auditSources.socketHook, 'handlers.forEach(({ event, handler }) => {', 'multi-listener cleanup');
console.log('      PASS');

// Validate all transformed files before any write happens.
for (const [ok, label] of [
  [files.endorsementQueue.source.includes('FALLBACK_REFRESH_INTERVAL_MS = 2 * 60 * 1000'), 'endorsement fallback is two minutes'],
  [!files.endorsementQueue.source.includes('setInterval(() => loadQueue({ soft: true }), 8000)'), '8-second endorsement polling removed'],
  [files.profilePhotoQueue.source.includes("useSocketEvent('profile-photo-review:created'"), 'profile created listener retained'],
  [files.profilePhotoQueue.source.includes("useSocketEvent('profile-photo-review:updated'"), 'profile updated listener retained'],
  [!files.profilePhotoQueue.source.includes("useSocketEvent('profile-photo-review:approved'"), 'dead profile approved listener removed'],
  [!files.profilePhotoQueue.source.includes("useSocketEvent('profile-photo-review:rejected'"), 'dead profile rejected listener removed'],
  [files.payoutManagement.source.includes("useSocketEvent('payout:created'"), 'payout created listener retained'],
  [files.payoutManagement.source.includes("useSocketEvent('payout:updated'"), 'payout updated listener retained'],
  [!files.payoutManagement.source.includes("useSocketEvent('payout:archived'"), 'duplicate payout archived listener removed'],
  [!files.payoutManagement.source.includes("useSocketEvent('payout:restored'"), 'duplicate payout restored listener removed'],
  [!files.payoutManagement.source.includes("useSocketEvent('scholar:released'"), 'duplicate scholar released listener removed from payout page'],
  [!files.adminDashboard.source.includes("useSocketEvent('payout:archived'"), 'duplicate dashboard payout archived listener removed'],
  [!files.adminDashboard.source.includes("useSocketEvent('payout:restored'"), 'duplicate dashboard payout restored listener removed'],
  [!files.adminDashboard.source.includes("useSocketEvent('scholar:released'"), 'duplicate dashboard scholar released listener removed'],
  [!files.reportGeneration.source.includes("useSocketEvent('payout:"), 'reports rely on report:updated instead of duplicate payout listeners'],
  [count(files.roController.source, "io.emit('ro:updated', data);") === 1, 'RO direct canonical fallback exists only once'],
  [files.roController.source.includes('socketEvents.roUpdated(io, data);'), 'RO canonical socket utility retained'],
  [files.roController.source.includes("io.emit('roUpdated', data);"), 'RO legacy alias retained once'],
]) {
  if (!ok) {
    throw new Error(
      `Validation failed before write: ${label}. No project files were written.`
    );
  }
}

const testFile = path.join(
  adminBackend,
  'test',
  'admin-realtime-audit-contract.test.js'
);

const testSource = String.raw`'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repo, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function occurrences(source, needle) {
  return source.split(needle).length - 1;
}

test('Applications and FCFS refresh from the canonical application realtime path', () => {
  const bridge = read('admin/backend/services/realtimeBridgeService.js');
  const openingApplications = read('admin/frontend/src/pages/OpeningApplications.jsx');

  assert.match(bridge, /table: 'applications'/);
  assert.match(bridge, /emitPublic\(io, 'application:updated'/);
  assert.match(openingApplications, /useSocketEvent\('application:updated'/);
  assert.match(openingApplications, /queue_position/);
  assert.match(openingApplications, /fcfs_completed_at/);
});

test('Endorsement realtime is primary and polling is only a low-frequency visible-tab fallback', () => {
  const bridge = read('admin/backend/services/realtimeBridgeService.js');
  const queue = read('admin/frontend/src/pages/EndorsementQueue.jsx');

  assert.match(bridge, /table: 'endorsement_slips'/);
  assert.match(queue, /useSocketEvent\('endorsement:updated'/);
  assert.match(queue, /FALLBACK_REFRESH_INTERVAL_MS = 2 \* 60 \* 1000/);
  assert.doesNotMatch(queue, /setInterval\(\(\) => loadQueue\(\{ soft: true \}\), 8000\)/);
});

test('Profile photo queue uses the actual bridge events only', () => {
  const bridge = read('admin/backend/services/realtimeBridgeService.js');
  const queue = read('admin/frontend/src/pages/ProfilePhotoQueue.jsx');

  assert.match(bridge, /table: 'profile_photo_reviews'/);
  assert.match(queue, /profile-photo-review:created/);
  assert.match(queue, /profile-photo-review:updated/);
  assert.doesNotMatch(queue, /profile-photo-review:approved/);
  assert.doesNotMatch(queue, /profile-photo-review:rejected/);
});

test('Accounts update through the maintenance realtime channel', () => {
  const panel = read('admin/frontend/src/pages/maintenance/AccountsPanel.jsx');
  const controller = read('admin/backend/controllers/accountController.js');

  assert.match(panel, /'maintenance:updated'/);
  assert.match(panel, /\['accounts', 'courses', 'pd_course_assignments'\]/);
  assert.match(controller, /socketEvents\.maintenanceUpdated\(io, payload\)/);
});

test('Payout pages avoid multiple reloads for the same mutation', () => {
  const page = read('admin/frontend/src/pages/PayoutManagement.jsx');
  const dashboard = read('admin/frontend/src/pages/AdminDashboard.jsx');
  const reports = read('admin/frontend/src/pages/ReportGeneration.jsx');
  const controller = read('admin/backend/controllers/payoutController.js');

  assert.match(page, /useSocketEvent\('payout:created'/);
  assert.match(page, /useSocketEvent\('payout:updated'/);
  assert.doesNotMatch(page, /useSocketEvent\('payout:archived'/);
  assert.doesNotMatch(page, /useSocketEvent\('payout:restored'/);
  assert.doesNotMatch(page, /useSocketEvent\('scholar:released'/);

  assert.doesNotMatch(dashboard, /useSocketEvent\('payout:archived'/);
  assert.doesNotMatch(dashboard, /useSocketEvent\('payout:restored'/);
  assert.doesNotMatch(dashboard, /useSocketEvent\('scholar:released'/);

  assert.doesNotMatch(reports, /useSocketEvent\('payout:/);
  assert.match(reports, /useSocketEvent\('report:updated'/);
  assert.match(controller, /socketEvents\.payoutUpdated\(io, payload\)/);
  assert.match(controller, /socketEvents\.reportUpdated/);
});

test('RO emits one canonical admin-web event while keeping one legacy alias', () => {
  const controller = read('admin/backend/controllers/roController.js');
  const relayRoutes = read('admin/backend/routes/internalRealtimeRoutes.js');
  const mobileController = read('mobile/backend/src/controllers/roController.js');
  const mobileRelay = read('mobile/backend/src/services/adminRealtimeRelayService.js');

  assert.match(controller, /socketEvents\.roUpdated\(io, data\)/);
  assert.equal(occurrences(controller, "io.emit('ro:updated', data);"), 1);
  assert.match(controller, /io\.emit\('roUpdated', data\)/);

  assert.match(relayRoutes, /router\.post\('\/ro-updated'/);
  assert.match(mobileController, /relayRoUpdated/);
  assert.match(mobileRelay, /relayRoUpdated/);
});

test('Renewals are bridged and consumed in Scholar Monitoring', () => {
  const bridge = read('admin/backend/services/realtimeBridgeService.js');
  const scholars = read('admin/frontend/src/pages/ScholarMonitoring.jsx');

  assert.match(bridge, /table: 'renewals'/);
  assert.match(bridge, /table: 'renewal_documents'/);
  assert.match(bridge, /emitPublic\(io, 'renewal:updated'/);
  assert.match(scholars, /'renewal:updated'/);
});

test('Socket hook unregisters the exact handlers it registers', () => {
  const hook = read('admin/frontend/src/hooks/useSocket.js');

  assert.match(hook, /let globalSocket = null;/);
  assert.match(hook, /socket\.on\(event, handler\)/);
  assert.match(hook, /socket\.off\(event, handler\)/);
  assert.match(hook, /handlers\.forEach\(\(\{ event, handler \}\) =>/);
});
`;

const rollbackRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'smartpdm-admin-realtime-audit-v1-')
);

const backups = [];

for (const state of Object.values(files)) {
  const relative = path.relative(repo, state.file);
  const backup = path.join(rollbackRoot, relative);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.copyFileSync(state.file, backup);
  backups.push({ file: state.file, backup, existed: true });
}

const testExisted = fs.existsSync(testFile);
const testBackup = path.join(
  rollbackRoot,
  path.relative(repo, testFile)
);

if (testExisted) {
  fs.mkdirSync(path.dirname(testBackup), { recursive: true });
  fs.copyFileSync(testFile, testBackup);
}

function rollback() {
  for (const item of backups) {
    fs.copyFileSync(item.backup, item.file);
  }

  if (testExisted) {
    fs.copyFileSync(testBackup, testFile);
  } else if (fs.existsSync(testFile)) {
    fs.unlinkSync(testFile);
  }
}

try {
  for (const state of Object.values(files)) {
    writeNormalized(state);
  }

  fs.writeFileSync(testFile, testSource, 'utf8');

  // Syntax-check the real backend file changed by this patch.
  run('node', ['--check', 'controllers/roController.js'], adminBackend);

  // Targeted contract tests prove all checklist paths and duplicate cleanup.
  run(
    'node',
    ['--test', 'test/admin-realtime-audit-contract.test.js'],
    adminBackend
  );

  // Compile the real React/Vite admin frontend after JSX edits.
  run('npm', ['run', 'build'], adminFrontend);

  // Match the safety behavior of the reference installer: finish with the
  // project's complete backend Node test suite before declaring success.
  run('npm', ['test'], adminBackend);
} catch (error) {
  console.error(
    '\nAdmin Realtime Audit v1 failed. Restoring previous files...'
  );

  rollback();

  console.error(`Rollback completed from: ${rollbackRoot}`);
  throw error;
}

try {
  fs.rmSync(rollbackRoot, { recursive: true, force: true });
} catch (_) {}

console.log(
  '\nPASS: Admin realtime audit + duplicate cleanup + Admin frontend build + full backend test suite passed.'
);
