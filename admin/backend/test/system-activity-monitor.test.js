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
