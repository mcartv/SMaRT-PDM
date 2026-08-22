'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { read } = require('./_current-system-test-utils');

const academic = read('backend/services/academicYearService.js');
const selection = read('backend/services/selectionService.js');
const readiness = read('backend/services/readinessQueueService.js');
const adminOpenings = read('backend/services/programOpeningService.js');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const mobileOpenings = fs.readFileSync(
  path.join(
    repoRoot,
    'mobile',
    'backend',
    'src',
    'services',
    'openingService.js'
  ),
  'utf8'
);

test('academic period activation closes previous Draft/Open scholarship openings without archiving them', () => {
  assert.match(
    academic,
    /closeOpeningsOutsideActiveCycle[\s\S]*posting_status = 'closed'/i
  );
  assert.match(
    academic,
    /COALESCE\(is_archived, false\) = false/i
  );
  assert.match(
    academic,
    /period_id IS DISTINCT FROM/i
  );
  assert.match(
    academic,
    /closed_openings:\s*closedOpenings/i
  );
});

test('an OPEN opening cannot be finalized early while scholarship slots remain unfilled', () => {
  assert.match(
    selection,
    /OPENING_STILL_HAS_AVAILABLE_SLOTS/i
  );
  assert.match(
    selection,
    /partitioned\.available_slots\s*>\s*partitioned\.selected_count/i
  );
});

test('FCFS synchronization removes activated scholars from the queue while keeping their slots occupied and closes a full opening', () => {
  assert.match(
    readiness,
    /application_status[\s\S]*NOT IN \('approved', 'rejected', 'disqualified'\)/i
  );
  assert.match(
    readiness,
    /openingIsFull\s*=\s*capacity\s*>\s*0\s*&&\s*occupiedSlots\s*>=\s*capacity/i
  );
  assert.match(
    readiness,
    /posting_status = CASE[\s\S]*THEN 'closed'/i
  );
});

test('existing waiting-list promotion remains available when a scholar slot is released', () => {
  assert.match(
    selection,
    /async function promoteNextWaitlisted/i
  );
  assert.match(
    selection,
    /selection_status = 'Promoted'/i
  );
  assert.match(
    selection,
    /waitlist_position = waitlist_position - 1/i
  );
});

test('mobile application intake is restricted to the active academic period', () => {
  assert.match(
    mobileOpenings,
    /getActiveAcademicPeriod/i
  );
  assert.match(
    mobileOpenings,
    /openingAcceptsApplications =[\s\S]*isCurrentPeriod/i
  );
  assert.match(
    mobileOpenings,
    /belongs to a previous academic period/i
  );
});

test('legacy mobile opening feed is also restricted to the active period', () => {
  assert.match(
    adminOpenings,
    /resolveActiveAcademicPeriodId/i
  );
  assert.match(
    adminOpenings,
    /\.eq\('period_id', activePeriodId\)/i
  );
});
