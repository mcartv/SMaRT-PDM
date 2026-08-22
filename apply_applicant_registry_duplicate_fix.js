#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);

  while (true) {
    if (
      fs.existsSync(path.join(dir, 'admin', 'backend', 'services', 'applicationService.js')) &&
      fs.existsSync(path.join(dir, 'admin', 'backend', 'test'))
    ) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    'Could not find the SMaRT-PDM repository root. Run this script from inside D:\\projects\\SMaRT-PDM.'
  );
}

function backup(file) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = `${file}.bak-applicant-registry-dedupe-${stamp}`;
  fs.copyFileSync(file, out);
  return out;
}

function replaceOnce(text, from, to, label) {
  if (text.includes(to)) {
    return text;
  }

  if (!text.includes(from)) {
    throw new Error(`Could not find expected ${label}. No unsafe edit was made.`);
  }

  return text.replace(from, to);
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

const repo = findRepoRoot(process.cwd());

const servicePath = path.join(
  repo,
  'admin',
  'backend',
  'services',
  'applicationService.js'
);

const testPath = path.join(
  repo,
  'admin',
  'backend',
  'test',
  'application-registry-current-application-regression.test.js'
);

let service = fs.readFileSync(servicePath, 'utf8');
const serviceBackup = backup(servicePath);

const helper = `function dedupeOperationalApplicationRows(rows = []) {
    const grouped = new Map();

    for (const row of rows || []) {
        if (!row?.application_id) continue;

        const key = [
            row.student_id || 'unknown-student',
            row.opening_id || 'unknown-opening',
        ].join(':');

        const existing = grouped.get(key);

        if (!existing) {
            grouped.set(key, row);
            continue;
        }

        const currentApplicationId =
            row.current_application_id ||
            existing.current_application_id ||
            null;

        const rowIsCurrent =
            !!currentApplicationId &&
            String(row.application_id) === String(currentApplicationId);

        const existingIsCurrent =
            !!currentApplicationId &&
            String(existing.application_id) === String(currentApplicationId);

        if (rowIsCurrent && !existingIsCurrent) {
            grouped.set(key, row);
            continue;
        }

        if (existingIsCurrent && !rowIsCurrent) {
            continue;
        }

        const rowSubmittedAt = new Date(
            row.submission_date || 0
        ).getTime();

        const existingSubmittedAt = new Date(
            existing.submission_date || 0
        ).getTime();

        if (rowSubmittedAt > existingSubmittedAt) {
            grouped.set(key, row);
            continue;
        }

        if (
            rowSubmittedAt === existingSubmittedAt &&
            String(row.application_id).localeCompare(
                String(existing.application_id)
            ) > 0
        ) {
            grouped.set(key, row);
        }
    }

    return [...grouped.values()];
}

`;

if (!service.includes('function dedupeOperationalApplicationRows(rows = [])')) {
  service = replaceOnce(
    service,
    'exports.fetchApplications = async () => {',
    helper + 'exports.fetchApplications = async () => {',
    'fetchApplications helper insertion point'
  );
}

service = replaceOnce(
  service,
  '    const mappedRows = rows.map((row) => {',
  `    // A student can have stale legacy application rows from an earlier
    // application attempt in the same opening. The Applicant Registry must
    // show only the canonical current application. Prefer
    // students.current_application_id; if legacy data has no pointer, keep
    // the newest submitted application for that student/opening.
    const operationalRows = dedupeOperationalApplicationRows(rows);

    const mappedRows = operationalRows.map((row) => {`,
  'Applicant Registry row mapping'
);

fs.writeFileSync(servicePath, service, 'utf8');

const regressionTest = `'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

const source = read('backend/services/applicationService.js');

test('Applicant Registry excludes archived/tombstoned application and student records', () => {
  assert.match(
    source,
    /COALESCE\\(a\\.is_archived, FALSE\\) = FALSE/i
  );
  assert.match(
    source,
    /COALESCE\\(st\\.is_archived, FALSE\\) = FALSE/i
  );
  assert.match(
    source,
    /username[\\s\\S]*NOT LIKE 'deleted-%'/i
  );
  assert.match(
    source,
    /email[\\s\\S]*NOT LIKE 'deleted-%'/i
  );
});

test('Applicant Registry deduplicates stale applications by student and opening', () => {
  assert.match(
    source,
    /function dedupeOperationalApplicationRows\\(rows = \\[\\]\\)/i
  );
  assert.match(
    source,
    /row\\.student_id[\\s\\S]*row\\.opening_id/i
  );
  assert.match(
    source,
    /current_application_id/i
  );
  assert.match(
    source,
    /const operationalRows = dedupeOperationalApplicationRows\\(rows\\)/i
  );
});

test('canonical current_application_id is preferred before timestamp fallback', () => {
  const currentCheck = source.indexOf('const rowIsCurrent');
  const timestampCheck = source.indexOf('const rowSubmittedAt');

  assert.notEqual(currentCheck, -1);
  assert.notEqual(timestampCheck, -1);
  assert.ok(
    currentCheck < timestampCheck,
    'current_application_id should be preferred before timestamp fallback'
  );
});
`;

fs.writeFileSync(testPath, regressionTest, 'utf8');

console.log('\nApplicant Registry duplicate-row fix applied.\n');
console.log('Changed:');
console.log('  admin/backend/services/applicationService.js');
console.log('  admin/backend/test/application-registry-current-application-regression.test.js');
console.log('\nBackup:');
console.log(`  ${serviceBackup}`);

const backend = path.join(repo, 'admin', 'backend');

run('node', ['--check', servicePath], repo);
run(
  'node',
  ['--test', path.join('test', 'application-registry-current-application-regression.test.js')],
  backend
);

console.log('\nPASS: Applicant Registry duplicate regression test passed.');
console.log('\nNext:');
console.log('  cd admin\\backend');
console.log('  npm test');
console.log('  npm start');
console.log('\nThen refresh Applications -> Applicant Registry.');
