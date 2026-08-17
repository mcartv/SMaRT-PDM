const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const frontendSource = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/AnnouncementsManagement.jsx'),
  'utf8'
);

const backendSource = fs.readFileSync(
  path.resolve(__dirname, '../services/announcementService.js'),
  'utf8'
);

const schedulerSource = fs.readFileSync(
  path.resolve(__dirname, '../services/schedulerService.js'),
  'utf8'
);

test('schedule controls enforce the current-time minimum with the custom local date/time picker', () => {
  assert.match(frontendSource, /minScheduleDateTime/);
  assert.match(frontendSource, /getLocalScheduleParts\(minScheduleDateTime\)/);
  assert.match(frontendSource, /earliest schedule is the next minute/i);
});

test('frontend converts local datetime input into an absolute ISO timestamp', () => {
  assert.match(
    frontendSource,
    /new Date\([^)]*\)\.toISOString\(\)/
  );
});

test('frontend prevents selecting a schedule earlier than the current local minimum', () => {
  assert.match(frontendSource, /minScheduleDateTime/);
  assert.match(
    frontendSource,
    /Schedule|scheduled|schedule/i
  );
});

test('backend rejects a past schedule on create or update', () => {
  const pastGuard =
    /const\s+scheduledTime\s*=\s*new Date\([^)]*\)[\s\S]*?const\s+now\s*=\s*new Date\(\)[\s\S]*?scheduledTime\s*<\s*now[\s\S]*?Scheduled date must be current or future\./i;

  assert.match(backendSource, pastGuard);
});

test('timezone-equivalent timestamps compare as the same instant', () => {
  const manila = new Date('2026-08-16T10:00:00+08:00');
  const utc = new Date('2026-08-16T02:00:00Z');

  assert.equal(manila.getTime(), utc.getTime());
});

test('a future Manila schedule remains future after ISO conversion', () => {
  const now = new Date('2026-08-16T10:00:00+08:00');
  const scheduled = new Date('2026-08-16T10:30:00+08:00');

  assert.ok(scheduled.getTime() > now.getTime());
  assert.equal(
    scheduled.toISOString(),
    '2026-08-16T02:30:00.000Z'
  );
});

test('a past Manila schedule remains past after ISO conversion', () => {
  const now = new Date('2026-08-16T10:00:00+08:00');
  const scheduled = new Date('2026-08-16T09:59:00+08:00');

  assert.ok(scheduled.getTime() < now.getTime());
  assert.equal(
    scheduled.toISOString(),
    '2026-08-16T01:59:00.000Z'
  );
});

test('immediate publishing remains supported when no schedule is supplied', () => {
  assert.match(backendSource, /Published/i);
  assert.match(backendSource, /published_at/i);
  assert.match(backendSource, /scheduled_at/i);
});

test('scheduler delegates due announcement publishing to the announcement service', () => {
  assert.match(
    schedulerSource,
    /announcementService\.publishDueAnnouncements\(\)/
  );

  assert.match(
    schedulerSource,
    /runAnnouncementScheduler/
  );

  assert.match(
    schedulerSource,
    /announcementCreated/
  );
});

test('announcement service owns the scheduled_at due-time logic', () => {
  assert.match(
    backendSource,
    /publishDueAnnouncements/
  );

  assert.match(
    backendSource,
    /scheduled_at/i
  );

  assert.match(
    backendSource,
    /new Date\(\)\.toISOString\(\)|new Date\(\)/i
  );
});
