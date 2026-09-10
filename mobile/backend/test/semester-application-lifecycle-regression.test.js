'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const frontendRoot = path.join(mobileRoot, 'frontend');

const read = (filePath) => fs.readFileSync(filePath, 'utf8');

const openingService = read(
  path.join(backendRoot, 'src', 'services', 'openingService.js')
);

const applicationService = read(
  path.join(backendRoot, 'src', 'services', 'applicationService.js')
);

const newApplicantScreen = read(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'applicant',
    'presentation',
    'screens',
    'new_applicant_screen.dart'
  )
);

test('old-semester applications do not block the active semester', () => {
  assert.match(
    openingService,
    /SMART_PDM_ACTIVE_APPLICATION_PERIOD_SCOPE_V1/
  );
  assert.match(
    openingService,
    /program_openings\s*\(\s*period_id,\s*academic_year_id\s*\)/s
  );
  assert.match(
    openingService,
    /isActiveApplication\(application\)[\s\S]*applicationBelongsToPeriod\([\s\S]*activePeriod\?\.period_id/s
  );
});

test('historical submitted application data is a fallback prefill only', () => {
  assert.match(
    applicationService,
    /SMART_PDM_HISTORICAL_APPLICATION_PREFILL_V1/
  );
  assert.match(
    applicationService,
    /getLatestApplicationPrefillPayload\(student\.student_id\)/
  );
  assert.match(
    applicationService,
    /mergeHistoricalApplicationPrefill\(\s*basePayload,\s*historicalApplicationPayload\s*\)/
  );

  const helperStart = applicationService.indexOf(
    'function mergeHistoricalApplicationPrefill'
  );
  const helperEnd = applicationService.indexOf(
    'async function getLatestApplicationPrefillPayload',
    helperStart
  );
  const helper = applicationService.slice(helperStart, helperEnd);

  assert.match(helper, /'personal'/);
  assert.match(helper, /'family'/);
  assert.match(helper, /'academic'/);
  assert.match(helper, /'essays'/);
  assert.doesNotMatch(helper, /reusableSections\s*=\s*\[[\s\S]*'opening'/);
  assert.doesNotMatch(helper, /reusableSections\s*=\s*\[[\s\S]*'certification'/);
});

test('new-semester draft replacement keeps prefill and restores new opening', () => {
  assert.match(
    newApplicantScreen,
    /SMART_PDM_SEMESTER_PREFILL_RETAIN_V1/
  );

  const marker = newApplicantScreen.indexOf(
    'SMART_PDM_SEMESTER_PREFILL_RETAIN_V1'
  );
  const applySaved = newApplicantScreen.indexOf(
    '_data.applySavedForm(savedFormData);',
    marker
  );
  const replacementBranch = newApplicantScreen.indexOf(
    'if (shouldReplaceDraft)',
    marker
  );
  const restoreOpening = newApplicantScreen.indexOf(
    '_applyOpeningSelection(',
    replacementBranch
  );
  const draftReset = newApplicantScreen.indexOf(
    '_hasDraftLoaded = false;',
    replacementBranch
  );

  assert.ok(applySaved > marker);
  assert.ok(replacementBranch > applySaved);
  assert.ok(restoreOpening > replacementBranch);
  assert.ok(draftReset > restoreOpening);
});

test('new application lifecycle does not inherit old workflow state', () => {
  const helperStart = applicationService.indexOf(
    'function mergeHistoricalApplicationPrefill'
  );
  const helperEnd = applicationService.indexOf(
    'async function getLatestApplicationPrefillPayload',
    helperStart
  );
  const helper = applicationService.slice(helperStart, helperEnd);

  assert.match(
    helper,
    /Never reuse the old scholarship[\s\S]*workflow state[\s\S]*documents/s
  );
  assert.match(
    helper,
    /merged\.opening = basePayload\.opening/
  );
  assert.match(
    helper,
    /merged\.certification = basePayload\.certification/
  );
});
