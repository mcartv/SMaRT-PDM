const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const file = path.join(
  root,
  'mobile/frontend/lib/features/forms/presentation/screens/status_tracking_screen.dart'
);
const source = fs.readFileSync(file, 'utf8');

test('Phase 1.1 keeps the status polish marker', () => {
  assert.match(source, /SMART-PDM_STATUS_POLISH_PHASE_1_1/);
});

test('application tracker is vertical and includes scholar activation', () => {
  assert.match(source, /class _VerticalWorkflowTracker/);
  assert.match(source, /label: 'Selection & Activation'/);
  assert.doesNotMatch(source, /class _WorkflowStageTracker/);
  assert.match(source, /'selected_for_activation'/);
  assert.match(source, /'waitlisted'/);
});

test('readiness no longer duplicates quick status cards', () => {
  assert.match(source, /class _ReadinessTimeline/);
  assert.doesNotMatch(source, /class _QuickStatusRow/);
  assert.doesNotMatch(source, /Use these three checks first/);
});

test('application ID is hidden under user-facing Show more details', () => {
  assert.match(source, /_showMore \? 'Show less' : 'Show more'/);
  assert.match(source, /'Application ID'/);
  assert.doesNotMatch(source, /Technical details/);
  assert.doesNotMatch(source, /Application identifiers/);
  assert.doesNotMatch(source, /label: 'Opening ID'/);
});

test('office reviews use collapsible rows that start closed', () => {
  assert.match(source, /class _OfficeReviewList/);
  assert.match(source, /initiallyExpanded: false/);
  assert.doesNotMatch(source, /_isCurrentOffice/);
  assert.match(source, /maintainState: true/);
});

test('application status icons use semantic workflow colors', () => {
  assert.match(source, /AppStatusColors\.of\(context\)/);
  assert.match(source, /colors\.successOutline/);
  assert.match(source, /colors\.inProgressOutline/);
  assert.match(source, /colors\.actionRequiredOutline/);
  assert.match(source, /colors\.dangerOutline/);
  assert.match(source, /colors\.neutralOutline/);
});

test('status hero keeps branded gold brown treatment', () => {
  assert.match(source, /class _CurrentStatusHero/);
  assert.match(source, /LinearGradient/);
  assert.match(source, /AppColors\.gold/);
  assert.match(source, /AppColors\.darkBrown/);
});

test('long statuses are not forced into capsules', () => {
  assert.match(source, /class _AdaptiveStatusLabel/);
  assert.match(source, /text\.length <= 18/);
  assert.match(source, /softWrap: true/);
});

test('redundant Quick Actions card is removed', () => {
  assert.doesNotMatch(source, /'Quick Actions'/);
  assert.doesNotMatch(source, /Open Scholarship Requirements/);
  assert.doesNotMatch(source, /Open Endorsement Tracker/);
});

test('current backend final-selection states stay on the final tracker stage', () => {
  for (const stage of [
    'ready_for_selection',
    'waitlisted',
    'not_selected',
    'selected_for_activation',
    'scholar_activated',
  ]) {
    assert.ok(source.includes(`'${stage}'`), `missing workflow stage ${stage}`);
  }
});

test('realtime refresh and slip download behavior remain present', () => {
  assert.match(source, /MobileRealtimeService\.instance\.isRealtimeHealthy/);
  assert.match(source, /fetchMyApplicationStatusSummary/);
  assert.match(source, /downloadMyEndorsementSlip/);
  assert.match(source, /saveAndOpenDownloadedFile/);
});
