import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Execute the real hook with deterministic hook slots so request races can be tested without a browser.
function createHookHarness() {
  const slots = [];
  let cursor = 0;
  const useState = (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
  };
  const useRef = (initial) => {
    const index = cursor++;
    return slots[index] ||= { current: initial };
  };
  const context = { useState, useRef, useCallback: (callback) => callback, useMemo: (factory) => factory(), URLSearchParams };
  const code = fs.readFileSync(path.join(root, 'src/hooks/useListPage.js'), 'utf8')
    .replace(/^import[^\n]+\n/, '').replace('export function', 'function');
  vm.runInNewContext(code + '\nthis.hook = useListPage;', context);
  return { render(filters = {}, limit = 10) { cursor = 0; return context.hook(filters, limit); } };
}

test('filter, sort and tab changes synchronously request page one', () => {
  for (const field of ['search', 'program', 'academicYear', 'semester', 'status', 'sort', 'tab']) {
    const harness = createHookHarness();
    harness.render({ [field]: 'first' }).setPage(5);
    assert.equal(harness.render({ [field]: 'first' }).page, 5);
    const next = harness.render({ [field]: 'second' });
    assert.equal(next.page, 1);
    assert.equal(new URLSearchParams(next.query).get('page'), '1');
    assert.equal(harness.render({ [field]: 'first' }).page, 1);
  }
});

test('page navigation keeps backend filters and module page size', () => {
  const harness = createHookHarness();
  harness.render({ search: 'TES', tab: 'completed' }, 6).setPage(3);
  const page = harness.render({ search: 'TES', tab: 'completed' }, 6);
  const query = new URLSearchParams(page.query);
  assert.equal(query.get('page'), '3');
  assert.equal(query.get('limit'), '6');
  assert.equal(query.get('search'), 'TES');
  assert.equal(query.get('tab'), 'completed');
});

test('late responses from another page or filter cannot replace the active list', () => {
  const harness = createHookHarness();
  const first = harness.render({ search: 'old' });
  const oldRequest = first.beginRequest();
  const next = harness.render({ search: 'new' });
  assert.equal(oldRequest(), false);
  const currentRequest = next.beginRequest();
  assert.equal(currentRequest(), true);
  next.setPage(2);
  harness.render({ search: 'new' });
  assert.equal(currentRequest(), false);
});

test('overlapping realtime refreshes accept only the latest response', () => {
  const page = createHookHarness().render({ status: 'pending' });
  const first = page.beginRequest();
  const second = page.beginRequest();
  assert.equal(first(), false);
  assert.equal(second(), true);
});

test('a queued callback from an old filter cannot invalidate the current request', () => {
  const harness = createHookHarness();
  const old = harness.render({ tab: 'active' });
  const current = harness.render({ tab: 'archived' });
  const currentRequest = current.beginRequest();
  const obsoleteRequest = old.beginRequest();
  assert.equal(obsoleteRequest(), false);
  assert.equal(currentRequest(), true);
});

test('backend page recovery retains global totals and updates navigation', () => {
  const harness = createHookHarness();
  harness.render({}).setPage(5);
  const page = harness.render({});
  page.accept({ items: [], pagination: { page: 3, total: 23, totalPages: 3 }, summary: { pending: 100 } });
  const recovered = harness.render({});
  assert.equal(recovered.page, 3);
  assert.equal(recovered.metadata.pagination.total, 23);
  assert.equal(recovered.metadata.summary.pending, 100);
});

for (const page of ['ScholarMonitoring', 'SDOScholarList', 'PayoutManagement', 'OpeningApplications', 'EndorsementQueue', 'AllEndorsementsTracker', 'AnnouncementsManagement', 'ProfilePhotoQueue']) {
  test(`${page} connects list state and realtime refreshes to backend pagination`, () => {
    const code = fs.readFileSync(path.join(root, 'src/pages', page + '.jsx'), 'utf8');
    assert.match(code, /useListPage\(/);
    assert.match(code, /listQuery/);
    assert.match(code, /listMetadata\.pagination/);
    assert.match(code, /useSocketEvent\(/);
    assert.doesNotMatch(code, /(?:currentRows|filteredScholars|filteredDisplayedBatches|filteredItems|filtered)\.slice\(/);
  });
}
