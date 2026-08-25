'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read, exists } = require('./_current-system-test-utils');

test('Maintenance exposes one Scholarship Programs workspace', () => {
  const source = read('frontend/src/pages/maintenance/Maintenance.jsx');

  assert.match(source, /label:\s*'Scholarship Programs'/);
  assert.match(source, /ScholarshipProgramsPanel/);

  // Be precise: the old separate imports/routes are what must be gone.
  assert.doesNotMatch(source, /from ['"]\.\/BenefactorsPanel['"]/);
  assert.doesNotMatch(source, /from ['"]\.\/ProgramsPanel['"]/);
  assert.doesNotMatch(source, /label:\s*'Benefactors'/);
  assert.doesNotMatch(source, /label:\s*'Programs'/);
});

test('merged panel supports combined provider creation and additional programs', () => {
  const source = read('frontend/src/pages/maintenance/ScholarshipProgramsPanel.jsx');

  assert.match(source, /Add Benefactor & Program/);
  assert.match(source, /\/api\/benefactors\/with-program/);
  assert.match(source, /Add Program/);
});

test('combined backend route is present', () => {
  const routes = read('backend/routes/benefactorRoutes.js');

  assert.match(routes, /\/with-program/);
  assert.match(routes, /createBenefactorWithProgram/);
});
