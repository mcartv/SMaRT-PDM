'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.resolve(
    __dirname,
    '..',
    '..',
    'frontend',
    'lib',
    'features',
    'forms',
    'presentation',
    'screens',
    'step_submit_intake.dart'
  ),
  'utf8'
);

test('review validation banner stays hidden before a submit attempt', () => {
  assert.match(
    source,
    /Widget _warningBox\(\) \{[\s\S]*?if \(!widget\.showErrors\) return const SizedBox\.shrink\(\);/
  );
});

test('review section asks the applicant to double-check the form', () => {
  assert.match(source, /V\. REVIEW APPLICATION/);
  assert.match(
    source,
    /Please double-check your application form and make sure all information is correct before submitting\./
  );
});
