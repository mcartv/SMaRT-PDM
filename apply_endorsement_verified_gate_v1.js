#!/usr/bin/env node
'use strict';

/*
 * SMaRT-PDM — Endorsement Verified Gate v1
 *
 * Audited against:
 *   mcartv/SMaRT-PDM
 *   10ac51e89a5872964455481d1295bc38c7ade816
 *
 * Behavior:
 * - Existing endorsement rows are preserved for audit/history.
 * - SDO / Guidance / PD operational queues only expose applications whose
 *   required documents were verified by Admin.
 * - Direct slip detail/action APIs enforce the same gate.
 * - If Admin later requests a correction and requirements_verified_at is
 *   cleared, the endorsement becomes hidden/blocked again until reverified.
 * - Office dashboards refresh when application verification changes.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipAdminBuild = args.includes('--skip-admin-build');
const rootArg = args.find((arg) => !arg.startsWith('--')) || '.';
const root = path.resolve(process.cwd(), rootArg);

const REL = {
  service: 'admin/backend/services/endorsementSlipService.js',
  dashboard: 'admin/frontend/src/components/endorsement/OfficeDashboard.jsx',
  test: 'admin/backend/test/endorsement-verified-gate-contract.test.js',
};

function abs(rel) {
  return path.join(root, rel);
}

function fail(message) {
  console.error('\n[ENDORSEMENT VERIFIED GATE] ERROR: ' + message);
  process.exit(1);
}

function read(rel) {
  const file = abs(rel);
  if (!fs.existsSync(file)) {
    throw new Error('Required file not found: ' + rel);
  }
  return fs.readFileSync(file, 'utf8');
}

function adaptEol(value, source) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  return String(value).replace(/\r\n/g, '\n').replace(/\n/g, eol);
}

function replaceOne(source, oldValue, newValue, label) {
  const oldNative = adaptEol(oldValue, source);
  const newNative = adaptEol(newValue, source);

  if (source.includes(newNative)) {
    console.log('[already] ' + label);
    return source;
  }

  const count = source.split(oldNative).length - 1;
  if (count !== 1) {
    throw new Error(
      `${label}: expected exactly 1 source match, found ${count}.`
    );
  }

  console.log('[patch] ' + label);
  return source.replace(oldNative, newNative);
}

function replaceFirst(source, oldValue, newValue, label) {
  const oldNative = adaptEol(oldValue, source);
  const newNative = adaptEol(newValue, source);

  if (source.includes(newNative)) {
    console.log('[already] ' + label);
    return source;
  }

  const index = source.indexOf(oldNative);
  if (index < 0) {
    throw new Error(`${label}: source anchor was not found.`);
  }

  console.log('[patch] ' + label);
  return (
    source.slice(0, index) +
    newNative +
    source.slice(index + oldNative.length)
  );
}

function run(command, commandArgs, cwd, label) {
  console.log('\n[verify] ' + label);

  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`${label} could not start: ${result.error.message}`);
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    throw new Error(label + ' failed.');
  }
}

function patchService(source) {
  let out = source;

  out = replaceOne(
    out,
    `function ensureTrackerAccess(actor = {}) {
    const role = safeText(actor?.role).toLowerCase();
    if (!['admin', 'pd', 'guidance', 'sdo'].includes(role)) {
        throw createHttpError(403, 'Access denied for endorsement tracking.');
    }
}
`,
    `function ensureTrackerAccess(actor = {}) {
    const role = safeText(actor?.role).toLowerCase();
    if (!['admin', 'pd', 'guidance', 'sdo'].includes(role)) {
        throw createHttpError(403, 'Access denied for endorsement tracking.');
    }
}

// SMART-PDM_ENDORSEMENT_VERIFIED_GATE_V1
function appendVerifiedApplicationGate(conditions = []) {
    conditions.push(
        \`lower(trim(coalesce(a.verification_status, ''))) = 'verified'\`
    );
    conditions.push('a.requirements_verified_at is not null');
    conditions.push('coalesce(a.is_archived, false) = false');
    conditions.push('coalesce(a.is_disqualified, false) = false');
    conditions.push(
        \`lower(trim(coalesce(a.application_status, ''))) <> 'rejected'\`
    );
}

function assertVerifiedApplicationForEndorsement(row = {}) {
    const verificationStatus = safeText(
        row.application_verification_status || row.verification_status
    ).toLowerCase();

    const applicationStatus = safeText(
        row.linked_application_status || row.application_status
    ).toLowerCase();

    const eligible =
        verificationStatus === 'verified' &&
        Boolean(row.requirements_verified_at) &&
        row.application_is_archived !== true &&
        row.application_is_disqualified !== true &&
        applicationStatus !== 'rejected';

    if (!eligible) {
        throw createHttpError(
            409,
            'Endorsement is not available until Admin verifies all required application documents.'
        );
    }
}
`,
    'Backend: add verified-application endorsement gate'
  );

  out = replaceOne(
    out,
    `    const conditions = [];

    if (normalizedStages.length > 0) {`,
    `    const conditions = [];

    // Keep stale/premature endorsement rows in the database for history, but
    // do not expose them to SDO/Guidance/PD until Admin finishes verification.
    appendVerifiedApplicationGate(conditions);

    if (normalizedStages.length > 0) {`,
    'Backend: filter all endorsement queues/trackers'
  );

  out = replaceFirst(
    out,
    `        where es.slip_id = $1
        limit 1`,
    `        where es.slip_id = $1
          and lower(trim(coalesce(a.verification_status, ''))) = 'verified'
          and a.requirements_verified_at is not null
          and coalesce(a.is_archived, false) = false
          and coalesce(a.is_disqualified, false) = false
          and lower(trim(coalesce(a.application_status, ''))) <> 'rejected'
        limit 1`,
    'Backend: protect direct endorsement detail'
  );

  out = replaceOne(
    out,
    `            select es.*, st.course_id, st.gwa, trim(concat(coalesce(st.first_name, ''), ' ', coalesce(st.last_name, ''))) as student_name
            from endorsement_slips es
            join students st on st.student_id = es.student_id
            where es.slip_id = $1
            for update`,
    `            select
                es.*,
                st.course_id,
                st.gwa,
                trim(concat(coalesce(st.first_name, ''), ' ', coalesce(st.last_name, ''))) as student_name,
                a.verification_status as application_verification_status,
                a.requirements_verified_at,
                a.application_status as linked_application_status,
                a.is_archived as application_is_archived,
                a.is_disqualified as application_is_disqualified
            from endorsement_slips es
            join students st on st.student_id = es.student_id
            join applications a on a.application_id = es.application_id
            where es.slip_id = $1
            for update`,
    'Backend: load application verification state for office actions'
  );

  out = replaceFirst(
    out,
    `        const currentSlip = currentResult.rows[0];`,
    `        const currentSlip = currentResult.rows[0];

        // A stale/direct URL cannot bypass the same eligibility rule used by
        // the visible SDO/Guidance/PD queues.
        assertVerifiedApplicationForEndorsement(currentSlip);`,
    'Backend: block endorsement actions for unverified applications'
  );

  return out;
}

function patchDashboard(source) {
  return replaceOne(
    source,
    `  useSocketEvent(
    'endorsement:updated',
    () => {
      loadRows({ soft: true });
    },
    [tokenStorageKey]
  );

  const cards = useMemo(() => config.cards(rows), [config, rows]);`,
    `  useSocketEvent(
    'endorsement:updated',
    () => {
      loadRows({ soft: true });
    },
    [tokenStorageKey]
  );

  // Admin document verification changes endorsement eligibility even when the
  // endorsement row itself was created earlier. Refresh the office queue as
  // soon as the application verification state changes.
  useSocketEvent(
    'application:updated',
    () => {
      loadRows({ soft: true });
    },
    [tokenStorageKey]
  );

  const cards = useMemo(() => config.cards(rows), [config, rows]);`,
    'Frontend: refresh endorsement dashboard after Admin verification'
  );
}

const CONTRACT = `'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');

function source(rel) {
  return fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\\r\\n/g, '\\n');
}

test('endorsement requires verified Admin documents', () => {
  const service = source(
    'admin/backend/services/endorsementSlipService.js'
  );
  const dashboard = source(
    'admin/frontend/src/components/endorsement/OfficeDashboard.jsx'
  );

  assert.ok(
    service.includes('SMART-PDM_ENDORSEMENT_VERIFIED_GATE_V1')
  );

  assert.ok(
    service.includes(
      "lower(trim(coalesce(a.verification_status, ''))) = 'verified'"
    )
  );

  assert.ok(
    service.includes('a.requirements_verified_at is not null')
  );

  assert.ok(
    service.includes('coalesce(a.is_archived, false) = false')
  );

  assert.ok(
    service.includes('coalesce(a.is_disqualified, false) = false')
  );

  assert.ok(
    service.includes(
      'assertVerifiedApplicationForEndorsement(currentSlip);'
    )
  );

  assert.ok(
    service.includes(
      'Endorsement is not available until Admin verifies all required application documents.'
    )
  );

  assert.ok(dashboard.includes("'application:updated'"));
  assert.ok(dashboard.includes("loadRows({ soft: true });"));
});
`;

function prepareWrites() {
  const originals = new Map();
  const writes = new Map();

  for (const [rel, patcher] of [
    [REL.service, patchService],
    [REL.dashboard, patchDashboard],
  ]) {
    const current = read(rel);

    if (/^<<<<<<<[^\r\n]*$/m.test(current)) {
      throw new Error('Unresolved Git merge markers remain in ' + rel + '.');
    }

    originals.set(rel, current);
    writes.set(rel, patcher(current));
  }

  const testFile = abs(REL.test);

  if (fs.existsSync(testFile)) {
    const current = fs.readFileSync(testFile, 'utf8');
    originals.set(REL.test, current);

    if (current !== CONTRACT) {
      throw new Error(
        `${REL.test} already exists with different content.`
      );
    }

    writes.set(REL.test, current);
    console.log('[already] ' + REL.test);
  } else {
    originals.set(REL.test, null);
    writes.set(REL.test, CONTRACT);
    console.log('[patch] Add ' + REL.test);
  }

  return { originals, writes };
}

function restore(originals) {
  for (const [rel, original] of originals.entries()) {
    const file = abs(rel);

    try {
      if (original === null) {
        fs.rmSync(file, { force: true });
      } else {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, original, 'utf8');
      }
    } catch (_) {}
  }
}

let prepared;

try {
  prepared = prepareWrites();
} catch (error) {
  fail(error.message || String(error));
}

if (dryRun) {
  console.log('\n[ENDORSEMENT VERIFIED GATE] Dry run passed.');
  console.log('No files were written.');
  process.exit(0);
}

try {
  for (const [rel, content] of prepared.writes.entries()) {
    const file = abs(rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf8');
  }

  run(
    process.execPath,
    ['--check', abs(REL.service)],
    root,
    'Node syntax: endorsement service'
  );

  run(
    process.execPath,
    ['--test', abs(REL.test)],
    root,
    'Endorsement verified-gate contract'
  );

  if (!skipAdminBuild) {
    const adminFrontend = path.join(root, 'admin/frontend');

    if (process.platform === 'win32') {
      run(
        process.env.ComSpec || 'cmd.exe',
        ['/d', '/c', 'npm run build'],
        adminFrontend,
        'Admin frontend build'
      );
    } else {
      run(
        'npm',
        ['run', 'build'],
        adminFrontend,
        'Admin frontend build'
      );
    }
  } else {
    console.log('\n[verify] Admin build skipped by --skip-admin-build.');
  }
} catch (error) {
  restore(prepared.originals);
  fail(
    (error.message || String(error)) +
      '\nAll files changed by this run were restored.'
  );
}

console.log('\n[ENDORSEMENT VERIFIED GATE] Installed successfully.');
console.log('');
console.log('Expected workflow:');
console.log('  Form -> Documents -> Admin Verified -> SDO -> Guidance -> PD -> Readiness');
console.log('');
console.log('No SQL migration is required.');
