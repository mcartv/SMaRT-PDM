const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const programsPanelSource = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/maintenance/ProgramsPanel.jsx'),
  'utf8'
);

const programServiceSource = fs.readFileSync(
  path.resolve(__dirname, '../services/scholarshipProgramService.js'),
  'utf8'
);

const openingFrontendSource = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/ScholarshipOpenings.jsx'),
  'utf8'
);

const openingServiceSource = fs.readFileSync(
  path.resolve(__dirname, '../services/programOpeningService.js'),
  'utf8'
);

test('maintenance program template does not expose opening allocation fields', () => {
  assert.doesNotMatch(
    programsPanelSource,
    /Allocated Slots|Financial Allocation|Per Scholar Amount/i
  );

  assert.doesNotMatch(
    programsPanelSource,
    /\ballocated_slots\b|\bfinancial_allocation\b|\bper_scholar_amount\b/
  );
});

test('scholarship program service does not persist opening allocation fields', () => {
  assert.doesNotMatch(
    programServiceSource,
    /\ballocated_slots\b|\bfinancial_allocation\b|\bper_scholar_amount\b/
  );

  for (const requiredTemplateField of [
    'benefactor_id',
    'program_name',
    'description',
    'target_audience',
    'gwa_threshold',
    'renewal_cycle',
    'visibility_status',
    'is_archived',
  ]) {
    assert.match(programServiceSource, new RegExp(`\\b${requiredTemplateField}\\b`));
  }
});

test('actual scholarship opening still owns allocated slot capacity', () => {
  assert.match(openingFrontendSource, /\ballocated_slots\b/);
  assert.match(openingFrontendSource, /Allocated Slots/i);

  assert.match(openingServiceSource, /\ballocated_slots\b/);
  assert.match(
    openingServiceSource,
    /remaining_slots:\s*Math\.max\(allocatedSlots\s*-\s*effectiveFilledSlots,\s*0\)/
  );
});

test('opening creation still requires positive allocated slots before becoming open', () => {
  assert.match(
    openingFrontendSource,
    /Number\(payload\.allocated_slots\s*\|\|\s*0\)\s*>\s*0/
  );

  assert.match(
    openingServiceSource,
    /allocatedSlots\s*>\s*0/
  );
});

test('program and opening responsibilities remain separate', () => {
  assert.match(programsPanelSource, /Scholarship Program/i);
  assert.match(programsPanelSource, /Benefactor/i);
  assert.match(programsPanelSource, /Target Audience/i);
  assert.match(programsPanelSource, /Renewal Cycle/i);
  assert.match(programsPanelSource, /GWA Threshold/i);

  assert.match(openingFrontendSource, /Academic Year/i);
  assert.match(openingFrontendSource, /Allocated Slots/i);
  assert.match(openingFrontendSource, /Waiting List/i);
  assert.match(openingFrontendSource, /Opening Notes/i);
});
