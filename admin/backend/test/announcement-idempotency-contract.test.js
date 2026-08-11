'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('editing an already-published announcement does not create another notification batch', () => {
  const source = read('admin/backend/services/announcementService.js');

  assert.match(source, /select\('status, publish_date, published_at'\)/);
  assert.match(source, /const wasPublished =/);
  assert.match(source, /const publishedNow = publishesImmediately && !wasPublished/);
  assert.match(source, /if \(publishedNow && data\.status === 'Published'\)/);
  assert.match(source, /publishedNow,/);
});

test('published announcement notifications are unique per recipient and announcement', () => {
  const service = read('admin/backend/services/notificationService.js');
  const migration = read('supabase/migrations/20260811222000_dedupe_announcement_notifications.sql');

  assert.match(service, /WHERE NOT EXISTS \(/);
  assert.match(service, /existing\.user_id = target\.user_id/);
  assert.match(service, /existing\.reference_id = \$5/);
  assert.match(service, /ON CONFLICT DO NOTHING/);
  assert.match(migration, /PARTITION BY user_id, reference_id/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_announcement_recipient/);
});

test('realtime published event is emitted only for a publication action/transition', () => {
  const source = read('admin/backend/controllers/announcementController.js');

  assert.match(source, /if \(action === 'published'\)/);
  assert.doesNotMatch(source, /action === 'published' \|\| status === 'published'/);
  assert.match(source, /if \(updated\?\.publishedNow === true\)/);
});
