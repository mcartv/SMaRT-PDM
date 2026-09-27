const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');

function read(relativePath) {
  return fs.readFileSync(
    path.join(mobileRoot, 'frontend', 'lib', ...relativePath),
    'utf8'
  );
}

const payout = read([
  'features',
  'scholar',
  'presentation',
  'screens',
  'payout_schedule_screen.dart',
]);
const renewal = read([
  'features',
  'applicant',
  'presentation',
  'screens',
  'scholar_renewal_requirements_screen.dart',
]);
const ro = read([
  'features',
  'scholar',
  'presentation',
  'screens',
  'ro_assignment_screen.dart',
]);

function sectionBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing section start: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('Phase 4 preserves scholar payout, renewal, and RO workflows', () => {
  assert.match(payout, /_pickAndUploadProof/);
  assert.match(payout, /_previewProof/);
  assert.match(renewal, /_pickAndUploadDocument/);
  assert.match(renewal, /_submitRenewal/);
  assert.match(ro, /_acknowledge/);
  assert.match(ro, /_timeIn/);
  assert.match(ro, /_timeOut/);
  assert.match(ro, /_reportConcern/);
});

test('payout cards adapt summaries, proof status, and metadata', () => {
  assert.match(payout, /SMART-PDM_MOBILE_SCHOLAR_PAYOUT_RESPONSIVE_PHASE4_V1/);
  const header = sectionBetween(payout, 'Widget _buildPayoutHeader', '\n  @override\n  void dispose');
  assert.match(header, /LayoutBuilder/);
  assert.match(header, /constraints\.maxWidth < 340 \|\| textScale > 1\.25/);
  const infoRow = sectionBetween(payout, 'Widget _infoRow', 'Widget _buildPayoutHeader');
  assert.match(infoRow, /constraints\.maxWidth < 300 \|\| textScale > 1\.3/);
  assert.match(infoRow, /return Column/);
  assert.match(infoRow, /return Row/);
  assert.match(payout, /constraints\.maxWidth < 300 \|\| textScale > 1\.25/);
});

test('renewal progress and document states no longer compete for one row', () => {
  assert.match(renewal, /SMART-PDM_MOBILE_SCHOLAR_RENEWAL_RESPONSIVE_PHASE4_V1/);
  const header = sectionBetween(renewal, 'Widget _buildHeaderCard', 'Widget _buildDocumentRow');
  assert.match(header, /LayoutBuilder/);
  assert.match(header, /constraints\.maxWidth < 300 \|\| textScale > 1\.3/);
  const documentRow = sectionBetween(renewal, 'Widget _buildDocumentRow', '\n  }\n}');
  const statusIndex = documentRow.indexOf('AppStatusCapsule(');
  const actionsIndex = documentRow.indexOf('OutlinedButton.icon(');
  assert.ok(statusIndex >= 0, 'document status is missing');
  assert.ok(actionsIndex > statusIndex, 'document status should precede its actions');
  assert.doesNotMatch(documentRow, /const SizedBox\(width: 12\),\s*AppStatusCapsule/);
});

test('RO cards keep full labels and place status with the relevant content', () => {
  assert.match(ro, /SMART-PDM_MOBILE_SCHOLAR_RO_RESPONSIVE_PHASE4_V1/);
  const card = sectionBetween(ro, 'class _AssignmentCard', 'class _ObligationDetailsSheet');
  assert.doesNotMatch(card, /TextOverflow\.ellipsis/);
  assert.doesNotMatch(card, /maxLines: 1/);
  assert.match(card, /label: 'Ongoing'/);
  assert.match(card, /formatMinutes\(item\.validatedMinutes\)/);
  const notice = sectionBetween(ro, 'class _NoticeHeader', 'class _NoticeDetails');
  assert.match(notice, /AppStatusCapsule/);
});

test('RO time actions stack on narrow screens or larger text', () => {
  const footer = sectionBetween(ro, 'class _ObligationActionFooter', 'class _ProofEntry');
  assert.match(footer, /LayoutBuilder/);
  assert.match(footer, /constraints\.maxWidth < 310 \|\| textScale > 1\.3/);
  assert.match(footer, /stackActions\s*\? Column|if \(stackActions\)/);
  assert.match(footer, /'Time In'/);
  assert.match(footer, /'Time Out'/);
  assert.match(footer, /'Report a concern'/);
});
