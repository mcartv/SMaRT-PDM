'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

const routes = read('backend/routes/applicationRoutes.js');
const registryService = read('backend/services/applicationRegistryService.js');

// Regression guard: opening the Applications module must remain a read path.
test('Applications registry GET uses the optimized read-only registry controller', () => {
  assert.match(
    routes,
    /applicationRegistryController\s*=\s*require\('\.\.\/controllers\/applicationRegistryController'\)/
  );
  assert.match(
    routes,
    /router\.get\('\/'[\s\S]*applicationRegistryController\.getApplications\)/
  );
});

test('Applications registry read path never performs the all-opening FCFS synchronization', () => {
  assert.doesNotMatch(registryService, /syncAllReadyApplications\s*\(/);
  assert.doesNotMatch(registryService, /syncOpeningFcfsQueue\s*\(/);
  assert.match(registryService, /intentionally read-only/i);
});

test('Applications registry deduplicates stale application attempts in SQL', () => {
  assert.match(registryService, /ROW_NUMBER\(\)\s+OVER/i);
  assert.match(registryService, /PARTITION BY a\.student_id, a\.opening_id/i);
  assert.match(registryService, /a\.application_id = st\.current_application_id/i);
  assert.match(registryService, /WHERE operational_rank = 1/i);
});

test('Applications registry preserves the existing batched readiness decoration', () => {
  assert.match(
    registryService,
    /applicationService\.decorateApplicationRecordsWithReadiness\(mappedRows\)/
  );
});
