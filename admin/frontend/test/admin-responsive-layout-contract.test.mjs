import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('admin dense tables retain horizontal overflow instead of crushing columns', () => {
  const applications = read('src/pages/ApplicationReview.jsx');
  const scholars = read('src/pages/ScholarMonitoring.jsx');
  const photos = read('src/pages/ProfilePhotoQueue.jsx');

  assert.match(applications, /overflow-x-auto/);
  assert.match(applications, /min-w-\[1210px\]/);
  assert.match(scholars, /min-w-\[980px\]/);
  assert.match(scholars, /min-w-\[1120px\]/);
  assert.match(photos, /min-w-\[760px\]/);
});

test('admin card-heavy modules do not force multi-column layouts too early', () => {
  const payouts = read('src/pages/PayoutManagement.jsx');
  const endorsements = read('src/pages/AllEndorsementsTracker.jsx');
  const photos = read('src/pages/ProfilePhotoQueue.jsx');

  assert.match(payouts, /grid gap-4 2xl:grid-cols-2/);
  assert.match(endorsements, /lg:grid-cols-3 2xl:grid-cols-5/);
  assert.match(endorsements, /xl:grid-cols-2/);
  assert.match(photos, /xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
});

test('endorsement filters stack on narrower desktop workspaces', () => {
  const endorsements = read('src/pages/AllEndorsementsTracker.jsx');
  assert.match(endorsements, /flex flex-col gap-2\.5 xl:flex-row xl:items-center/);
  assert.match(endorsements, /xl:w-52/);
  assert.match(endorsements, /xl:w-56/);
});
