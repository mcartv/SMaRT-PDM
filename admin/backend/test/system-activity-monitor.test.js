'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const activityService = require('../services/systemActivityService');

const frontendRoot = path.resolve(__dirname, '../../frontend/src');
const repositoryRoot = path.resolve(__dirname, '../../..');
const readFrontend = (relativePath) => fs.readFileSync(
  path.join(frontendRoot, relativePath),
  'utf8'
);

test('public visitor paths are limited to approved public routes', () => {
  assert.equal(activityService.normalizePublicPath('/landing'), '/landing');
  assert.equal(activityService.normalizePublicPath('/about/smart-pdm'), '/about/smart-pdm');
  assert.equal(
    activityService.normalizePublicPath('/endorsement/verify/example-token'),
    '/endorsement/verify/example-token'
  );

  assert.throws(
    () => activityService.normalizePublicPath('/admin/dashboard'),
    (error) => error.statusCode === 400 && /Invalid public web path/.test(error.message)
  );
  assert.throws(() => activityService.normalizePublicPath('/landing-spoof'), /Invalid public web path/);
  assert.throws(() => activityService.normalizePublicPath('https://example.com'), /Invalid public web path/);
});

test('visitor identifiers reject malformed or oversized input', () => {
  assert.equal(
    activityService.normalizeVisitorId('visitor_1234567890'),
    'visitor_1234567890'
  );
  assert.throws(() => activityService.normalizeVisitorId('short'), /Invalid visitor identifier/);
  assert.throws(() => activityService.normalizeVisitorId('a'.repeat(129)), /Invalid visitor identifier/);
});

test('authenticated presence heartbeat runs only for a visible portal tab', () => {
  const protectedRoute = readFrontend('components/auth/ProtectedRoute.jsx');

  assert.match(protectedRoute, /document\.visibilityState !== 'visible'/);
  assert.match(protectedRoute, /system-maintenance\/activity\/heartbeat/);
  assert.match(protectedRoute, /setInterval\(heartbeat, 4 \* 60 \* 1000\)/);
  assert.match(protectedRoute, /visibilitychange/);
});

test('privacy-mode visitor fallback remains stable and throttled in memory', () => {
  const tracker = readFrontend('components/system/PublicVisitorTracker.jsx');

  assert.match(tracker, /fallbackVisitorId \|\|= createVisitorId\(\)/);
  assert.match(tracker, /fallbackLastPingAt = timestamp/);
  assert.match(tracker, /now - lastPing < PING_INTERVAL_MS/);
  assert.match(tracker, /smartpdm:public-visit-recorded/);
});

test('landing page exposes responsive anonymous visitor counts', () => {
  const landing = readFrontend('pages/SmartPDMLanding.jsx');
  const routes = fs.readFileSync(
    path.join(repositoryRoot, 'admin/backend/routes/systemMaintenanceRoutes.js'),
    'utf8'
  );

  assert.match(landing, /WebsiteVisitorCounter/);
  assert.match(landing, /public-visitor-counts/);
  assert.match(landing, /Live site activity/);
  assert.match(landing, /Anonymous unique-browser counts/);
  assert.match(landing, /sm:grid-cols-3/);
  assert.match(routes, /get\('\/public-visitor-counts'/);
});

test('daily visitor aggregates are private and use Philippine calendar boundaries', () => {
  const migration = fs.readFileSync(
    path.join(
      repositoryRoot,
      'supabase/migrations/20260828120000_public_website_visitor_counts.sql'
    ),
    'utf8'
  );
  const activityServiceSource = fs.readFileSync(
    path.join(repositoryRoot, 'admin/backend/services/systemActivityService.js'),
    'utf8'
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.public_web_visitor_days/i);
  assert.match(migration, /ALTER TABLE public\.public_web_visitor_days ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /REVOKE ALL ON TABLE public\.public_web_visitor_days FROM anon, authenticated/i);
  assert.match(activityServiceSource, /COUNT\(DISTINCT visitor_hash\)/);
  assert.match(activityServiceSource, /Asia\/Manila/);
});

test('System Monitor tables are protected from direct Data API access', () => {
  const migration = fs.readFileSync(
    path.join(
      repositoryRoot,
      'supabase/migrations/20260828010000_protect_system_activity_tables.sql'
    ),
    'utf8'
  );

  for (const table of [
    'system_activity_hourly',
    'system_active_sessions',
    'public_web_visitors',
  ]) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'));
    assert.match(migration, new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM anon, authenticated`, 'i'));
  }
});
