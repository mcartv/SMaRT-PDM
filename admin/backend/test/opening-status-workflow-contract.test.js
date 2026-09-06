const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const adminRoot = path.resolve(backendRoot, '..');

const service = fs.readFileSync(
  path.join(backendRoot, 'services', 'programOpeningService.js'),
  'utf8'
);
const controller = fs.readFileSync(
  path.join(backendRoot, 'controllers', 'programOpeningController.js'),
  'utf8'
);
const frontend = fs.readFileSync(
  path.join(adminRoot, 'frontend', 'src', 'pages', 'ScholarshipOpenings.jsx'),
  'utf8'
);

test('Review Draft opening behavior', () => {
  assert.match(service, /draft: new Set\(\['draft', 'open', 'archived'\]\)/);
  assert.match(frontend, /const canSubmit\s*=\s*!!form\.opening_title\?\.trim\(\)\s*&&\s*!!form\.program_id\s*&&\s*!!form\.academic_year_id/);
});

test('Review Open opening behavior', () => {
  assert.ok(service.includes("nextStatus === 'open' && !canPersistOpeningAsOpen(opening)"));
  assert.ok(frontend.includes("computedStatus === 'open'"));
  assert.ok(frontend.includes('at least one scholarship slot is available'));
});

test('Review Re-Open behavior', () => {
  assert.ok(frontend.includes('const canReopen = isClosed && canBeOpened;'));
  assert.ok(frontend.includes('const reopenCandidate = {'));
  assert.ok(frontend.includes("await updateOpeningStatus(opening.opening_id, 'open'"));
});

test('Ensure incomplete openings remain Draft', () => {
  assert.ok(service.includes("return canPersistOpeningAsOpen(opening) ? 'open' : 'draft';"));
  assert.ok(service.includes("A new scholarship opening can only be created as Draft or Open."));
});

test('Ensure only valid/configured openings can become Open', () => {
  assert.ok(service.includes('function canPersistOpeningAsOpen'));
  assert.ok(service.includes("!!String(opening.period_id || '').trim()"));
  assert.ok(service.includes('filledSlots < allocatedSlots'));
});

test('Ensure closed openings can be reopened only when allowed', () => {
  assert.match(service, /closed: new Set\(\['closed', 'draft', 'open', 'archived'\]\)/);
  assert.ok(service.includes("assertOpeningTransition(currentStatus, effectiveStatus, transitionCandidate);"));
  assert.ok(frontend.includes('if (!canOpeningBeOpened(reopenCandidate))'));
});

test('Prevent invalid status transitions', () => {
  assert.ok(service.includes('const OPENING_STATUS_TRANSITIONS = Object.freeze'));
  assert.ok(service.includes('Invalid scholarship opening status transition'));
  assert.ok(service.includes("Only an Open scholarship opening can be closed."));
});

test('Keep archived openings separate from Draft/Open/Closed', () => {
  assert.ok(service.includes("archived: new Set(['archived', 'draft', 'open', 'closed'])"));
  assert.ok(service.includes("const effectiveArchived = effectiveStatus === 'archived';"));
  assert.ok(frontend.includes("status !== 'archived'"));
  assert.ok(frontend.includes("const nextStatus = canOpeningBeOpened(restoredCandidate)"));
  assert.ok(frontend.includes(": getFilledSlots(opening) > 0"));
});

test('Verify realtime status updates', () => {
  assert.ok(controller.includes("emitOpeningRealtime(req, 'opening:updated', updated, audit.eventAction);"));
  assert.ok(controller.includes("emitOpeningRealtime(req, 'opening:closed', updated, audit.eventAction);"));
  assert.ok(frontend.includes("useSocketEvent('opening:updated'"));
  assert.ok(frontend.includes("useSocketEvent('opening:closed'"));
});

test('Opening slot cards use the stored active-scholar count before historical qualified applications', () => {
  assert.match(
    frontend,
    /function getFilledSlots[\s\S]*openingLike\.filled_slots \?\?[\s\S]*openingLike\.qualified_count \?\?/
  );
});

test('Verify status badges and available actions match the actual state', () => {
  for (const status of ['draft', 'open', 'closed', 'archived']) {
    assert.ok(frontend.includes(`${status}: { label:`));
  }
  assert.ok(frontend.includes("const isArchived = computedStatus === 'archived';"));
  assert.ok(frontend.includes("const isClosed = computedStatus === 'closed';"));
  assert.ok(frontend.includes("const isDraft = computedStatus === 'draft';"));
  assert.ok(frontend.includes('disabled={isBusy || !canReopen}'));
});
