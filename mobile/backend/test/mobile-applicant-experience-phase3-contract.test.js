const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(mobileRoot, 'frontend', 'lib', ...relativePath), 'utf8');
}

const application = read([
  'features',
  'applicant',
  'presentation',
  'screens',
  'new_applicant_screen.dart',
]);
const intakeUi = read([
  'features',
  'forms',
  'presentation',
  'widgets',
  'intake_form_ui.dart',
]);
const success = read([
  'features',
  'forms',
  'presentation',
  'screens',
  'success_screen.dart',
]);

function sectionBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing section start: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('Phase 3 keeps the existing application workflow and responsive shell', () => {
  assert.match(application, /SMART-PDM_MOBILE_APPLICANT_EXPERIENCE_PHASE3_V1/);
  assert.match(application, /StepPersonal\(/);
  assert.match(application, /StepFamily\(/);
  assert.match(application, /StepAcademic\(/);
  assert.match(application, /StepEssay\(/);
  assert.match(application, /StepSubmit\(/);
  assert.match(application, /_queueAutosave\(/);
  assert.match(application, /_submitApplication/);
  assert.match(application, /if \(!keyboardOpen\) _buildFooter\(provider\)/);
});

test('selected scholarship and autosave feedback are no longer faded or clipped', () => {
  const selectedOpening = sectionBetween(
    application,
    'Widget _buildSelectedOpeningCard',
    'bool get _requiredStepGateComplete'
  );
  assert.doesNotMatch(selectedOpening, /TextOverflow\.fade/);
  assert.doesNotMatch(selectedOpening, /maxLines:/);
  assert.match(selectedOpening, /'Selected scholarship'/);
  assert.match(selectedOpening, /'Draft autosaves automatically\.'/);
});

test('application footer stacks actions for narrow widths and larger text', () => {
  const footer = sectionBetween(application, 'Widget _buildFooter', '\n  }\n}');
  assert.match(footer, /MediaQuery\.textScalerOf\(context\)\.scale\(1\)/);
  assert.match(footer, /width < 340 \|\| textScale > 1\.3/);
  assert.match(footer, /stackActions\s*\? Column/);
  assert.match(footer, /minimumSize: const Size\(0, 52\)/);
  assert.match(footer, /'Save Updates'/);
  assert.match(footer, /'Submit Application'/);
});

test('review rows stack labels and values instead of squeezing them', () => {
  const reviewRow = sectionBetween(
    intakeUi,
    'class IntakeReviewRow',
    '\n}\n'
  );
  assert.match(intakeUi, /SMART-PDM_MOBILE_APPLICANT_REVIEW_RESPONSIVE_PHASE3_V1/);
  assert.match(reviewRow, /LayoutBuilder/);
  assert.match(reviewRow, /constraints\.maxWidth < 340 \|\| textScale > 1\.2/);
  assert.match(reviewRow, /return Column/);
  assert.match(reviewRow, /return Row/);
});

test('submission success prioritizes the next applicant tasks', () => {
  assert.match(success, /SMART-PDM_MOBILE_APPLICATION_SUCCESS_PHASE3_V1/);
  const documentsIndex = success.indexOf("title: 'Manage Required Documents'");
  const trackingIndex = success.indexOf("title: 'Track Application'");
  const exportIndex = success.indexOf("'Export Application Form'");
  const dashboardIndex = success.indexOf("'Back to Dashboard'");
  assert.ok(documentsIndex >= 0, 'required documents action is missing');
  assert.ok(trackingIndex > documentsIndex, 'tracking should follow documents');
  assert.ok(exportIndex > trackingIndex, 'export should be a secondary action');
  assert.ok(dashboardIndex > exportIndex, 'dashboard should be the final navigation action');
  assert.match(success, /AppRoutes\.documents/);
  assert.match(success, /AppRoutes\.status/);
  assert.match(success, /AppRoutes\.home/);
});

test('submission success preserves PDF generation and removes redundant tracking banner', () => {
  assert.match(success, /_handleGeneratePdf/);
  assert.match(success, /generateBytesFromMySubmittedApplicationForm/);
  assert.match(success, /saveAndOpenDownloadedFile/);
  assert.doesNotMatch(success, /track your application status anytime in your dashboard/i);
});
