'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('mobile frontend endpoints missing from the previous backend contract are mounted', () => {
  const indexRoutes = read('mobile/backend/src/routes/index.js');
  const authRoutes = read('mobile/backend/src/routes/authRoutes.js');
  const profileRoutes = read('mobile/backend/src/routes/profileRoutes.js');
  const applicationRoutes = read('mobile/backend/src/routes/applicationRoutes.js');

  assert.match(authRoutes, /router\.post\('\/resend-otp'/);
  assert.match(authRoutes, /router\.post\('\/cancel-registration'/);
  assert.match(authRoutes, /router\.post\('\/recovery\/lookup'/);
  assert.match(authRoutes, /router\.post\('\/recovery\/reset-password'/);
  assert.match(profileRoutes, /router\.post\('\/setup'/);
  assert.match(applicationRoutes, /router\.get\('\/:applicationId'/);
  assert.match(indexRoutes, /router\.use\('\/api\/general-settings'/);
  assert.match(indexRoutes, /router\.use\('\/api\/system-maintenance'/);
  assert.match(indexRoutes, /router\.use\('\/api\/scholarship-programs'/);
});

test('public mobile settings use the same database-backed sources as the web process', () => {
  const service = read('mobile/backend/src/services/publicSettingsService.js');

  assert.match(service, /\.from\('general_settings'\)/);
  assert.match(service, /maintenance_mode/);
  assert.match(service, /landing_faqs/);
  assert.match(service, /featured_notice/);
  assert.match(service, /\.from\('scholarship_program'\)/);
  assert.match(service, /visibility_status', 'Published'/);
});

test('mobile messaging exposes web-aligned search and quick-like actions', () => {
  const mobile = read('mobile/frontend/lib/features/messaging/presentation/screens/messaging_screen.dart');
  const web = read('admin/frontend/src/pages/AdminMessages.jsx');

  assert.match(web, /title="Search this conversation"/);
  assert.match(web, /handleQuickLike/);
  assert.match(web, />👍</);
  assert.match(mobile, /tooltip: 'Search this conversation'/);
  assert.match(mobile, /_sendQuickLike/);
  assert.match(mobile, /const Text\('👍'/);
});

test('explicit localhost API base URLs are respected for development', () => {
  const config = read('mobile/frontend/lib/core/config/app_config.dart');

  assert.doesNotMatch(config, /host == 'localhost'/);
  assert.doesNotMatch(config, /host == '127\.0\.0\.1'/);
  assert.match(config, /uri\.host\.toLowerCase\(\) == '0\.0\.0\.0'/);
});
