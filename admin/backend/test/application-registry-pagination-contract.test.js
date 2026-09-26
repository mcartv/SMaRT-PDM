'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

const service = read('backend/services/applicationRegistryService.js');
const controller = read('backend/controllers/applicationRegistryController.js');
const frontend = read('frontend/src/pages/ApplicationReview.jsx');

test('registry uses 10 rows per page by default', () => {
  assert.match(service, /const DEFAULT_PAGE_SIZE = 10;/);
  assert.match(frontend, /const PAGE_SIZE = 10;/);
});

test('registry endpoint supports real server-side pagination', () => {
  assert.match(service, /async function fetchRegistryPage\(options = \{\}\)/);
  assert.match(service, /LIMIT \$\$?\{?limitIndex/i);
  assert.match(service, /OFFSET \$\$?\{?offsetIndex/i);
  assert.match(service, /registry_total AS \([\s\S]*COUNT\(\*\)::int AS filtered_total/i);
  assert.match(controller, /view === 'registry'/);
  assert.match(controller, /fetchRegistryPage\(options\)/);
});

test('registry search and filters are evaluated by PostgreSQL', () => {
  assert.match(service, /function buildFilterSql\(options = \{\}, values = \[\]\)/);
  assert.match(service, /REGEXP_REPLACE\(LOWER\(COALESCE\(oa\.pdm_id/i);
  assert.match(service, /oa\.academic_year/);
  assert.match(service, /oa\.application_status/);
  assert.match(service, /oa\.document_status/);
});

test('readiness is loaded independently from the paginated registry', () => {
  assert.match(service, /async function fetchReadinessApplications\(options = \{\}\)/);
  assert.match(service, /WHERE \(\$\{READINESS_PREDICATE\}\)/);
  assert.match(controller, /view === 'readiness'/);
  assert.match(frontend, /viewType === 'action'[\s\S]*'readiness'/);
  assert.match(frontend, /setReadinessRows\(responseRows\)/);
});

test('Cards use server opening summaries instead of the current registry page', () => {
  assert.match(service, /async function fetchOpeningSummaries\(\)/);
  assert.match(service, /readiness_signature/i);
  assert.match(service, /next_fcfs_applicant/i);
  assert.match(frontend, /openingSummaries\.map/);
  assert.match(frontend, /summary\.next_fcfs_applicant/);
});

test('frontend sends page, search, and active registry filters to the API', () => {
  assert.match(frontend, /params\.set\('page'/);
  assert.match(frontend, /params\.set\('limit'/);
  assert.match(frontend, /params\.set\('search'/);
  assert.match(frontend, /params\.set\('academicYear'/);
  assert.match(frontend, /params\.set\('applicationStatus'/);
  assert.match(frontend, /params\.set\('documentStatus'/);
  assert.match(frontend, /SEARCH_DEBOUNCE_MS = 300/);
});


test('opening summaries are refreshed only when the frontend requests them', () => {
  assert.match(controller, /includeSummary/);
  assert.match(frontend, /includeSummary: shouldRefreshSummary/);
  assert.match(frontend, /summaryLoaded/);
  assert.match(frontend, /openingsLoaded/);
});
