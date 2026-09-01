'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const frontendRoot = path.resolve(__dirname, '..', '..', 'frontend');
const intake = fs.readFileSync(
  path.join(frontendRoot, 'lib', 'features', 'forms', 'presentation', 'screens', 'step_academic_intake.dart'),
  'utf8'
);
const legacy = fs.readFileSync(
  path.join(frontendRoot, 'lib', 'features', 'forms', 'presentation', 'screens', 'step_academic.dart'),
  'utf8'
);
const validator = fs.readFileSync(
  path.join(frontendRoot, 'lib', 'features', 'forms', 'domain', 'validation', 'application_submission_validator.dart'),
  'utf8'
);

test('all mobile application section selectors expose A through D only', () => {
  for (const source of [intake, legacy]) {
    assert.match(source, /_defaultSectionOptions = \['A', 'B', 'C', 'D'\]/);
    assert.doesNotMatch(source, /_defaultSectionOptions[^\n]*'E'/);
  }
});

test('invalid saved sections are cleared instead of added to the dropdown', () => {
  assert.match(intake, /sectionOptions\.contains\(normalizedSection\)/);
  assert.doesNotMatch(intake, /sectionOptions\.add\(normalizedSection\)/);
});

test('submission validation rejects section E', () => {
  assert.match(validator, /!const \{'A', 'B', 'C', 'D'\}\.contains\(normalizedSection\)/);
  assert.match(validator, /Section must be A, B, C, or D\./);
});
