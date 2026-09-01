const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('scheduled announcements are checked within five seconds of becoming due', () => {
  const server = read('server/server.js');

  assert.match(server, /const ANNOUNCEMENT_SCHEDULER_INTERVAL_MS = 5 \* 1000/);
  assert.match(
    server,
    /setInterval\(runAnnouncementScheduler, ANNOUNCEMENT_SCHEDULER_INTERVAL_MS\)/
  );
  assert.match(server, /const BACKGROUND_SCHEDULER_INTERVAL_MS = 60 \* 1000/);
});

test('due detection uses an absolute UTC timestamp and excludes archived rows', () => {
  const service = read('services/announcementService.js');
  const page = read('../frontend/src/pages/AnnouncementsManagement.jsx');

  assert.match(service, /\.eq\('status', 'Scheduled'\)/);
  assert.match(service, /\.eq\('is_archived', false\)/);
  assert.match(service, /\.lte\('scheduled_at', nowIso\)/);
  assert.match(page, /new Date\(value\)\.toISOString\(\)/);
});

test('automatic publication emits published and refresh events', () => {
  const server = read('server/server.js');

  assert.match(server, /socketEvents\.announcementPublished\(io, payload\)/);
  assert.match(server, /socketEvents\.announcementUpdated\(io, payload\)/);
  assert.match(server, /socketEvents\.announcementRefresh\(io, payload\)/);
});
