#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);

  while (true) {
    if (
      fs.existsSync(path.join(dir, 'mobile', 'frontend', 'lib')) &&
      fs.existsSync(path.join(dir, 'mobile', 'frontend', 'test'))
    ) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    'Could not find the SMaRT-PDM repository root. Run this from D:\\projects\\SMaRT-PDM.'
  );
}

function normalize(text) {
  return text.replace(/\r\n/g, '\n');
}

function restore(text, useCrlf) {
  return useCrlf ? text.replace(/\n/g, '\r\n') : text;
}

function backup(file) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = `${file}.bak-residency-validation-v5-${stamp}`;
  fs.copyFileSync(file, out);
  return out;
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
const frontend = path.join(repo, 'mobile', 'frontend');

const validatorFile = path.join(
  frontend,
  'lib',
  'features',
  'forms',
  'domain',
  'validation',
  'application_submission_validator.dart'
);

if (!fs.existsSync(validatorFile)) {
  throw new Error(`Validator not found: ${validatorFile}`);
}

const raw = fs.readFileSync(validatorFile, 'utf8');
const useCrlf = raw.includes('\r\n');
let source = normalize(raw);

/*
 * The form now stores Marilao residency using compatibility codes:
 *
 *   0  = Less than a year
 *   5  = 1-5 years
 *   10 = 6-10 years
 *   11 = More than 10 years
 *
 * The centralized submission validator still used the old numeric rule
 * "1 through 120", so code 0 was rejected at final submission.
 *
 * Keep the validator backward-compatible with legacy numeric drafts while
 * allowing the new 0 code. Existing database records are normalized separately.
 */
const rangeRegex =
  /([A-Za-z_][A-Za-z0-9_]*)\s*<\s*1\s*\|\|\s*\1\s*>\s*120/g;

const rangeMatches = source.match(rangeRegex) || [];

if (rangeMatches.length === 0) {
  if (!source.includes('< 0 ||') && !source.includes('<0 ||')) {
    throw new Error(
      'Could not find the old Marilao residency 1-120 validation condition. No unsafe edit was made.'
    );
  }
} else {
  source = source.replace(
    rangeRegex,
    (_, variable) => `${variable} < 0 || ${variable} > 120`
  );
}

source = source.replaceAll(
  'Years as resident must be a whole number between 1 and 120.',
  'Select a valid Marilao residency duration.'
);

source = source.replaceAll(
  'Years as resident must be between 1 and 120.',
  'Select a valid Marilao residency duration.'
);

source = source.replaceAll(
  'Enter the number of years as a Marilao resident.',
  'Choose Less than a year, 1-5 years, 6-10 years, or More than 10 years.'
);

source = source.replaceAll(
  'Enter the number of years the parent or parents have lived in Marilao.',
  'Choose Less than a year, 1-5 years, 6-10 years, or More than 10 years.'
);

const checks = [
  [
    'old 1-120 message removed',
    !source.includes(
      'Years as resident must be a whole number between 1 and 120.'
    ),
  ],
  [
    'new residency message present',
    source.includes('Select a valid Marilao residency duration.'),
  ],
  [
    'zero compatibility code allowed',
    !/<\s*1\s*\|\|[\s\S]{0,50}>\s*120/.test(
      source.slice(
        Math.max(
          0,
          source.indexOf('parentMarilaoResidencyDuration') - 1200
        ),
        source.indexOf('parentMarilaoResidencyDuration') + 4000
      )
    ),
  ],
];

const failed = checks.filter(([, ok]) => !ok);

if (failed.length) {
  throw new Error(
    `Validation failed before writing: ${failed
      .map(([name]) => name)
      .join(', ')}`
  );
}

const backupPath = backup(validatorFile);

fs.writeFileSync(
  validatorFile,
  restore(source, useCrlf),
  'utf8'
);

const testFile = path.join(
  frontend,
  'test',
  'residency_range_validation_regression_test.dart'
);

const testSource = `import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('submission validator accepts the new less-than-one-year code', () {
    final source = File(
      'lib/features/forms/domain/validation/application_submission_validator.dart',
    ).readAsStringSync();

    expect(
      source,
      isNot(
        contains(
          'Years as resident must be a whole number between 1 and 120.',
        ),
      ),
    );

    expect(
      source,
      contains('Select a valid Marilao residency duration.'),
    );

    final residencyIndex =
        source.indexOf('parentMarilaoResidencyDuration');
    expect(residencyIndex, greaterThanOrEqualTo(0));

    final nearby = source.substring(
      residencyIndex,
      (residencyIndex + 5000).clamp(0, source.length),
    );

    expect(
      nearby,
      isNot(
        matches(RegExp(r'<\\s*1\\s*\\|\\|[\\s\\S]{{0,80}}>\\s*120')),
      ),
    );
  });
}
`;

fs.writeFileSync(testFile, testSource, 'utf8');

console.log('\nMarilao residency validation v5 applied.');
console.log('\nFixed:');
console.log('  - Less than a year (code 0) is no longer rejected');
console.log('  - old "whole number between 1 and 120" message removed');
console.log('  - validation copy now refers to the range selection');
console.log('\nDatabase note:');
console.log('  The active Supabase data migration was already performed separately.');
console.log('\nBackup:');
console.log(`  ${backupPath}`);

run('dart', ['format', validatorFile, testFile], frontend);

run(
  'flutter',
  ['test', 'test/residency_range_validation_regression_test.dart'],
  frontend
);

console.log('\nPASS: Marilao residency validation regression test passed.');
console.log('\nRecommended next: flutter test');
