'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

const readiness = read('backend/services/readinessQueueService.js');

test('FCFS eligibility still requires verified documents and completed endorsement', () => {
  assert.match(readiness, /verification_status[\s\S]*?'verified'/i);
  assert.match(readiness, /overall_status[\s\S]*?'completed'/i);
  assert.match(readiness, /COALESCE\(a\.is_disqualified,\s*false\)\s*=\s*false/i);
});

test('current FCFS policy compacts the active operational queue instead of preserving historical gaps', () => {
  assert.match(readiness, /queue_position represents the CURRENT active operational queue/i);
  assert.match(readiness, /Re-number the remaining queue contiguously/i);
  assert.match(readiness, /queue_position = \$3::integer/i);
  assert.doesNotMatch(
    readiness,
    /queue_position\s*=\s*COALESCE\(queue_position,\s*\$3::integer\)/i
  );
});

test('waiting-list position is recalculated and persisted for the current queue', () => {
  assert.match(readiness, /selection_status = 'Waitlisted'/i);
  assert.match(readiness, /waitlist_position = \$2::integer/i);
  assert.match(readiness, /waitingPosition \+= 1/);
});
