import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(frontendRoot, 'src/pages/ROAdmin.jsx'),
  'utf8'
);

test('Assigned, Unassigned and Cleared use 10 rows per page', () => {
  assert.match(source, /const RO_PAGE_SIZE = 10/);
  assert.match(source, /params\.set\('view', 'paginated'\)/);
  assert.match(source, /params\.set\('bucket', topTab\)/);
  assert.match(source, /params\.set\('limit', String\(RO_PAGE_SIZE\)\)/);
});

test('each RO tab retains its own page state', () => {
  assert.match(source, /assigned:\s*1/);
  assert.match(source, /unassigned:\s*1/);
  assert.match(source, /cleared:\s*1/);
  assert.match(source, /pageByTab\[topTab\]/);
});

test('RO pagination footer is functional instead of placeholder controls', () => {
  assert.match(
    source,
    /Showing \{pagination\.start\}-\{pagination\.end\} of \{pagination\.total\}/
  );
  assert.match(source, /setActivePage\(currentPage - 1\)/);
  assert.match(source, /setActivePage\(currentPage \+ 1\)/);
  assert.match(
    source,
    /Page \{pagination\.page\} \/ \{pagination\.totalPages\}/
  );
});

test('search and filter changes reset the active page', () => {
  assert.match(source, /resetActivePage\(\)/);
  assert.match(source, /setSelectedIds\(\[\]\)/);
  assert.match(source, /params\.set\('programId', programId\)/);
});

test('heavy RO history/log details are loaded only when View is opened', () => {
  assert.match(source, /async function openDetailsModal\(scholar\)/);
  assert.match(
    source,
    /\/api\/ro\/scholars\/\$\{scholar\.student_id\}\/history/
  );
  assert.match(source, /setDetailsLoading\(true\)/);
});

test('request sequence guards prevent stale search/page responses winning races', () => {
  assert.match(source, /scholarRequestSequenceRef/);
  assert.match(
    source,
    /requestSequence !== scholarRequestSequenceRef\.current/
  );
});


test('realtime RO updates refresh an open detailed scholar without loading all details in the list', () => {
  assert.match(source, /const refreshFromRealtime = async \(\) =>/);
  assert.match(source, /await loadScholarDetails\(detailTarget, \{ silent: true \}\)/);
});
