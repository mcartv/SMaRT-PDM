const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const openings = read('mobile/frontend/lib/features/applicant/presentation/screens/scholarship_openings_screen.dart');
const documents = read('mobile/frontend/lib/features/applicant/presentation/screens/applicant_documents_screen.dart');

test('opening refresh and application routes remain intact', () => {
  assert.match(openings, /Timer\.periodic\(const Duration\(seconds: 20\)/);
  assert.match(openings, /provider\.openingRevision == _lastOpeningRevision/);
  assert.match(openings, /fetchAvailableOpenings\(\)/);
  assert.match(openings, /AppRoutes\.newApplicant/);
  assert.match(openings, /AppRoutes\.documents/);
});

test('mobile opening cards do not expose admin-only capacity or waiting-list information', () => {
  assert.doesNotMatch(openings, /opening\.allocatedSlots/);
  assert.doesNotMatch(openings, /opening\.filledSlots/);
  assert.doesNotMatch(openings, /opening\.availableSlots/);
  assert.doesNotMatch(openings, /opening\.waitingList/);
  assert.doesNotMatch(openings, /opening\.targetAudience/);
});

test('opening period wraps instead of forcing one-line ellipsis', () => {
  const marker = openings.indexOf('_applicationPeriodLabel(opening)');
  assert.ok(marker >= 0);
  const block = openings.slice(marker, marker + 700);
  assert.match(block, /softWrap: true/);
  assert.doesNotMatch(block, /maxLines:\s*1/);
  assert.doesNotMatch(block, /TextOverflow\.ellipsis/);
});

test('GWA requirement is shown only from configured opening data', () => {
  assert.match(openings, /opening\.gwaThreshold/);
  assert.match(openings, /GWA requirement:/);
});

test('benefactor is presented without a nested description card', () => {
  assert.match(openings, /Supported by/);
  assert.doesNotMatch(openings, /benefactorDescription/);
});

test('saved draft remains clearly identified and draft conflict wording stays draft-specific', () => {
  assert.match(openings, /label: 'Continue application'/);
  assert.match(openings, /label: isApplied \? 'Applied' : 'Draft'/);
  assert.match(openings, /Saved application draft found/);
  assert.match(openings, /Continue Saved Draft/);
  assert.match(openings, /Use This Scholarship/);
});

test('applied opening focuses on requirement progress and document management', () => {
  assert.match(openings, /if \(isApplied\)/);
  assert.match(openings, /'Requirements'/);
  assert.match(openings, /required document\$\{remainingCount == 1/);
  assert.match(openings, /'Manage Documents'/);
});

test('normal apply copy can use Apply Now without replacing special API labels', () => {
  assert.match(openings, /normalized == 'apply for scholarship'/);
  assert.match(openings, /return 'Apply Now'/);
  assert.match(openings, /return label;/);
});

test('visible TES-specific presentation is removed from Scholarship Openings', () => {
  assert.doesNotMatch(openings, /label: 'TES'/);
  assert.doesNotMatch(openings, /TES scholarships/);
});

test('PSA section no longer describes the upload as optional', () => {
  assert.match(documents, /title: 'Additional Documents'/);
  assert.match(documents, /uploaded digitally or brought as a physical copy/);
  assert.match(documents, /Upload or bring physical copy/);
  assert.doesNotMatch(documents, /'Optional Documents'/);
  assert.doesNotMatch(documents, /'Optional Mobile Upload'/);
});
