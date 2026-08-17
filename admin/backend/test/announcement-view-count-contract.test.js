'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('admin announcement views are backed by unique persisted announcement views', () => {
  const service = read('admin/backend/services/announcementService.js');
  const migration = read('supabase/migrations/20260817202600_add_announcement_unique_views.sql');

  assert.doesNotMatch(service, /views:\s*0,/);
  assert.match(service, /from\('announcement_views'\)/);
  assert.match(service, /viewCounts\.get\(String\(row\.announcement_id\)\)/);
  assert.match(migration, /PRIMARY KEY \(announcement_id, user_id\)/);
});

test('mobile backend records an authenticated view only for an announcement the user may see', () => {
  const service = read('backend/src/services/announcementService.js');
  const controller = read('backend/src/controllers/announcementController.js');
  const routes = read('backend/src/routes/announcementRoutes.js');

  assert.match(service, /getVisibleAnnouncementForUser/);
  assert.match(service, /canViewAudience\(context, row\)/);
  assert.match(service, /from\('announcement_views'\)/);
  assert.match(service, /onConflict: 'announcement_id,user_id'/);
  assert.match(controller, /markAnnouncementViewed/);
  assert.match(routes, /:\announcementId\/view/);
});

test('mobile UI records a view when announcement content is actually opened', () => {
  const service = read('mobile/smartpdm_mobileapp/lib/features/applicant/data/services/announcement_service.dart');
  const announcementsScreen = read('mobile/smartpdm_mobileapp/lib/features/applicant/presentation/screens/announcements_screen.dart');
  const articleScreen = read('mobile/smartpdm_mobileapp/lib/features/applicant/presentation/screens/office_update_article_screen.dart');

  assert.match(service, /Future<void> markViewed/);
  assert.match(service, /\/api\/announcements\/\$id\/view/);
  assert.match(announcementsScreen, /markViewed\(announcement\.announcementId\)/);
  assert.match(articleScreen, /notification\.isAnnouncementNotification/);
  assert.match(articleScreen, /markViewed\(referenceId\)/);
});
