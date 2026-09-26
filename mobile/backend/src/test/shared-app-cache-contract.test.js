'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const srcRoot = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(srcRoot, relativePath), 'utf8');

test('mobile read-heavy reference/list routes use bounded server cache', () => {
  const cache = read('config/appCache.js');
  assert.match(cache, /MOBILE_APP_CACHE_MAX_ENTRIES/);
  assert.match(cache, /const store = new Map\(\)/);

  [
    'routes/announcementRoutes.js',
    'routes/faqRoutes.js',
    'routes/generalSettingRoutes.js',
    'routes/openingRoutes.js',
    'routes/scholarshipProgramRoutes.js',
  ].forEach((relativePath) => {
    assert.match(read(relativePath), /appCacheMiddleware/);
  });
});

test('mobile opening and announcement writes invalidate their cached lists', () => {
  assert.match(
    read('routes/openingRoutes.js'),
    /invalidateCacheOnSuccess/
  );
  assert.match(
    read('routes/announcementRoutes.js'),
    /invalidateCacheOnSuccess/
  );
});

test('mobile cache remains server-side while HTTP response is no-store', () => {
  const middleware = read('middleware/appCacheMiddleware.js');
  assert.match(middleware, /private, no-store, max-age=0/);
  assert.match(middleware, /X-SMaRT-Cache/);
});


test('mobile Supabase client installs realtime cache invalidation', () => {
  const config = read('config/supabase.js');
  const cache = read('config/appCache.js');

  assert.match(config, /installSupabaseRealtimeInvalidation/);
  assert.match(cache, /program_openings/);
  assert.match(cache, /scholarship_program/);
  assert.match(cache, /announcements/);
});

test('FAQ and public general-settings fallback cache is capped at 15 seconds', () => {
  assert.match(read('routes/faqRoutes.js'), /ttlMs:\s*15000/);
  assert.match(read('routes/generalSettingRoutes.js'), /ttlMs:\s*15000/);
});
