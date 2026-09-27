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

test('review section asks the applicant to check every saved detail', () => {
  assert.match(source, /V\. REVIEW & SUBMIT/);
  assert.match(
    source,
    /Open each section and check every detail you entered before submitting\./
  );
});

test('review sections are collapsible and Personal Information opens first', () => {
  assert.match(source, /_expandedSections = <String>\{'personal'\}/);
  assert.match(source, /AnimatedRotation\(/);
  assert.match(source, /AnimatedSize\(/);
  assert.match(source, /Icons\.keyboard_arrow_down_rounded/);
  for (const key of ['personal', 'family', 'academic', 'statement']) {
    assert.match(source, new RegExp(`sectionKey: '${key}'`));
  }
});
