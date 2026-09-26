'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminRoot = path.resolve(__dirname, '..', '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(adminRoot, relativePath), 'utf8');

test('shared cache is bounded and stores serialized JSON only', () => {
  const source = read('backend/config/appCache.js');
  assert.match(source, /APP_CACHE_MAX_ENTRIES/);
  assert.match(source, /const store = new Map\(\)/);
  assert.match(source, /JSON\.stringify\(body\)/);
  assert.match(source, /while \(store\.size > MAX_ENTRIES\)/);
});

test('private cached responses remain browser/CDN no-store', () => {
  const source = read('backend/middleware/appCacheMiddleware.js');
  assert.match(source, /private, no-store, max-age=0/);
  assert.match(source, /X-SMaRT-Cache/);
  assert.match(source, /res\.vary\('Authorization'\)/);
});

test('read-heavy admin modules opt into shared caching', () => {
  [
    'backend/routes/applicationRoutes.js',
    'backend/routes/programOpeningRoutes.js',
    'backend/routes/scholarshipProgramRoutes.js',
    'backend/routes/benefactorRoutes.js',
    'backend/routes/courseRoutes.js',
    'backend/routes/academicYearRoutes.js',
    'backend/routes/announcementRoutes.js',
    'backend/routes/themeSettingRoutes.js',
    'backend/routes/generalSettingRoutes.js',
    'backend/routes/endorsementSlipRoutes.js',
    'backend/routes/selectionRoutes.js',
    'backend/routes/scholarRoutes.js',
    'backend/routes/renewalRoutes.js',
    'backend/routes/payoutRoutes.js',
    'backend/routes/roRoutes.js',
    'backend/routes/roCoordinatorRoutes.js',
  ].forEach((relativePath) => {
    assert.match(read(relativePath), /appCacheMiddleware/);
  });
});

test('security/live modules are deliberately not cached', () => {
  [
    'backend/routes/authRoutes.js',
    'backend/routes/messageRoutes.js',
    'backend/routes/notificationRoutes.js',
    'backend/routes/ocrRoutes.js',
    'backend/routes/piRoutes.js',
    'backend/routes/auditLogRoutes.js',
  ].forEach((relativePath) => {
    assert.doesNotMatch(read(relativePath), /appCacheMiddleware/);
  });
});

test('report routes remain uncached so every preview keeps its existing audit semantics', () => {
  assert.doesNotMatch(
    read('backend/routes/reportRoutes.js'),
    /appCacheMiddleware/
  );
});

test('dashboard keeps its existing dedicated 30 second cache', () => {
  const source = read('backend/services/dashboardService.js');
  assert.match(source, /ADMIN_DASHBOARD_CACHE_TTL_MS/);
  assert.match(source, /30000/);
  assert.match(source, /dashboardCache/);
});

test('applications use shared route cache instead of standalone application cache', () => {
  const controller = read('backend/controllers/applicationRegistryController.js');
  const routes = read('backend/routes/applicationRoutes.js');

  assert.doesNotMatch(controller, /applicationRegistryCache/);
  assert.match(routes, /namespace:\s*'applications'/);
  assert.match(routes, /ttlMs:\s*3000/);
});

test('successful mutations invalidate dependent cached modules', () => {
  assert.match(read('backend/routes/applicationRoutes.js'), /invalidateCacheOnSuccess/);
  assert.match(read('backend/routes/programOpeningRoutes.js'), /'applications'/);
  assert.match(read('backend/routes/benefactorRoutes.js'), /'scholarship-programs'/);
  assert.match(read('backend/routes/endorsementSlipRoutes.js'), /'program-openings'/);
});


test('dynamic operational lists use only short three second caching', () => {
  [
    'backend/routes/scholarRoutes.js',
    'backend/routes/renewalRoutes.js',
    'backend/routes/payoutRoutes.js',
    'backend/routes/roRoutes.js',
    'backend/routes/roCoordinatorRoutes.js',
  ].forEach((relativePath) => {
    assert.match(read(relativePath), /ttlMs:\s*3000/);
  });
});

test('active renewal-document verification remains uncached', () => {
  const source = read('backend/routes/scholarRoutes.js');
  assert.match(
    source,
    /router\.get\('\/:id\/renewal-documents'[\s\S]*scholarController\.getScholarRenewalDocuments/
  );
  const segment = source.slice(
    source.indexOf("router.get('/:id/renewal-documents'"),
    source.indexOf("router.patch('/:id/renewal-documents")
  );
  assert.doesNotMatch(segment, /scholarCache/);
});


test('Supabase realtime changes invalidate shared caches before UI refresh events', () => {
  const config = read('backend/config/supabase.js');
  const cache = read('backend/config/appCache.js');

  assert.match(config, /installSupabaseRealtimeInvalidation/);
  assert.match(cache, /applications:\s*\[/);
  assert.match(cache, /application_documents:\s*\[/);
  assert.match(cache, /endorsement_slips:\s*\[/);
  assert.match(cache, /renewals:\s*\[/);
});
