'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(backendRoot, relativePath), 'utf8');

test('RO paginated endpoint keeps legacy callers backward compatible', () => {
  const controller = read('controllers/roPaginationController.js');

  assert.match(controller, /view !== 'paginated'/);
  assert.match(controller, /roController\.getROScholars\(req, res\)/);
  assert.match(controller, /roPaginationService\.getROScholarsPage/);
});

test('RO list uses true database LIMIT/OFFSET pagination with a 10 row default', () => {
  const service = read('services/roPaginationService.js');

  assert.match(service, /const DEFAULT_PAGE_SIZE = 10/);
  assert.match(service, /LIMIT \$\{limitRef\}::int/);
  assert.match(service, /OFFSET \(/);
  assert.match(service, /COUNT\(\*\)::int AS total_count/);
  assert.match(service, /submission_date DESC NULLS LAST/);
});

test('Assigned, Unassigned and Cleared are classified before page rows are returned', () => {
  const service = read('services/roPaginationService.js');

  assert.match(service, /bucket === 'unassigned'/);
  assert.match(service, /bucket === 'cleared'/);
  assert.match(service, /has_active_assignment/);
  assert.match(service, /is_cleared/);
});

test('server-side filters include search, course, program and year level', () => {
  const service = read('services/roPaginationService.js');

  assert.match(service, /courseId/);
  assert.match(service, /programId/);
  assert.match(service, /yearLevel/);
  assert.match(service, /ILIKE/);
});

test('RO details are not loaded for every paginated list row', () => {
  const service = read('services/roPaginationService.js');

  assert.doesNotMatch(service, /getLogsForROIds/);
  assert.doesNotMatch(service, /getProofsForLogIds/);
  assert.match(service, /pending_log_count/);
});

test('RO routes preserve existing mutation/invalidation workflow', () => {
  const routes = read('routes/roRoutes.js');

  assert.match(
    routes,
    /router\.get\('\/scholars', adminOnly, roCache, roPaginationController\.getROScholars\)/
  );
  assert.match(routes, /namespace:\s*'ro'/);
  assert.match(routes, /ttlMs:\s*3000/);
  assert.match(routes, /invalidateRo/);
  assert.match(routes, /roController\.assignScholarRO/);
  assert.match(routes, /roController\.clearScholarRO/);
});
