const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const read = (relative) => fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8');

test('announcement detail route records authenticated unique views', () => {
  const routes = read('src/routes/announcementRoutes.js');
  const controller = read('src/controllers/announcementController.js');
  const service = read('src/services/announcementService.js');

  assert.match(routes, /post\('\/:announcementId\/view', protect, announcementController\.markAnnouncementViewed\)/);
  assert.match(controller, /markAnnouncementViewed/);
  assert.match(service, /\.from\('announcement_views'\)/);
  assert.match(service, /\.upsert\(/);
  assert.match(service, /onConflict: 'announcement_id,user_id'/);
  assert.match(service, /ignoreDuplicates: true/);
  assert.match(service, /last_viewed_at/);
});
