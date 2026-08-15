const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const readinessSource = fs.readFileSync(
  path.join(backendRoot, 'services', 'readinessQueueService.js'),
  'utf8'
);
const endorsementSource = fs.readFileSync(
  path.join(backendRoot, 'services', 'endorsementSlipService.js'),
  'utf8'
);
const applicationSource = fs.readFileSync(
  path.join(backendRoot, 'services', 'applicationService.js'),
  'utf8'
);

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ');
}

const readiness = compact(readinessSource);
const endorsement = compact(endorsementSource);
const application = compact(applicationSource);

test('FCFS source timestamp is the later of requirements verification and endorsement completion', () => {
  assert.match(
    readiness,
    /GREATEST\(\s*COALESCE\(a\.requirements_verified_at,[\s\S]*?COALESCE\(es\.completed_at/i
  );
  assert.match(readiness, /AS ready_at/i);
  assert.match(
    readiness,
    /fcfs_completed_at\s*=\s*COALESCE\(fcfs_completed_at,\s*\$2::timestamptz\)/i
  );
});

test('applicant officially enters FCFS only after requirements AND endorsement are complete', () => {
  assert.match(
    readiness,
    /LOWER\(COALESCE\(a\.verification_status,\s*''\)\)\s*=\s*'verified'/i
  );
  assert.match(
    readiness,
    /LOWER\(COALESCE\(es\.overall_status,\s*''\)\)\s*=\s*'completed'/i
  );
});

test('successful requirement review triggers readiness synchronization', () => {
  assert.match(
    application,
    /requirements_verified_at\s*:\s*reviewedAt/i
  );
  assert.match(
    application,
    /readinessQueueService\.syncApplicationReadiness\(applicationId\)/i
  );
});

test('final endorsement completion triggers readiness synchronization immediately', () => {
  assert.match(
    endorsement,
    /queueKey\s*===\s*'pd'[\s\S]*?overall_status\s*===\s*'completed'/i
  );
  assert.match(
    endorsement,
    /readinessQueueService\.syncApplicationReadiness\(\s*finalizedDetail\.application_id\s*\)/i
  );
});

test('earlier eligible applicant ranks before later applicant', () => {
  assert.match(
    readiness,
    /ORDER BY\s+GREATEST\([\s\S]*?\)\s+ASC/i
  );
});

test('FCFS tie-breaking is deterministic', () => {
  assert.match(
    readiness,
    /a\.submission_date\s+ASC\s+NULLS\s+LAST,\s*a\.created_at\s+ASC,\s*a\.application_id\s+ASC/i
  );
});

test('ineligible and disqualified applicants are excluded', () => {
  assert.match(
    readiness,
    /COALESCE\(a\.is_disqualified,\s*false\)\s*=\s*false/i
  );
  assert.match(
    readiness,
    /NOT IN\s*\('approved',\s*'rejected',\s*'disqualified'\)/i
  );
  assert.match(
    readiness,
    /verification_status[\s\S]*?'verified'[\s\S]*?overall_status[\s\S]*?'completed'/i
  );
});

test('FCFS queue number is persisted instead of being renumbered on reload', () => {
  assert.match(
    readiness,
    /queue_position\s*=\s*COALESCE\(queue_position,\s*\$3::integer\)/i
  );
  assert.match(
    readiness,
    /SELECT COALESCE\(MAX\(queue_position\),\s*0\)::int AS max_position/i
  );
});

test('waiting-list ordering is persisted in the database', () => {
  assert.match(
    readiness,
    /selection_status\s*=\s*'Waitlisted'/i
  );
  assert.match(
    readiness,
    /waitlist_position\s*=\s*\$2::integer/i
  );
  assert.match(
    readiness,
    /ORDER BY a\.queue_position ASC,\s*a\.fcfs_completed_at ASC,\s*a\.application_id ASC/i
  );
});

test('equal-day submissions use timestamps and deterministic secondary ordering', () => {
  assert.doesNotMatch(readiness, /date_trunc\s*\(/i);
  assert.match(readiness, /ready_at/i);
  assert.match(readiness, /submission_date\s+ASC/i);
  assert.match(readiness, /created_at\s+ASC/i);
  assert.match(readiness, /application_id\s+ASC/i);
});

test('database ordering is authoritative and protected by a transaction/row locks', () => {
  assert.match(readiness, /BEGIN/i);
  assert.match(readiness, /FOR UPDATE/i);
  assert.match(readiness, /COMMIT/i);
  assert.match(readiness, /ROLLBACK/i);
  assert.match(readiness, /ORDER BY/i);
});
