const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('staff web realtime bridge does not show message toasts', () => {
  const bridge = read('frontend/src/components/system/WebRealtimeToastBridge.jsx');
  assert.match(bridge, /notification:new/);
  assert.doesNotMatch(bridge, /useSocketEvent\(\s*['"]message:new['"]/);
  assert.doesNotMatch(bridge, /realtime-message:/);
});

test('web message activity rows render as plain text without activity pills', () => {
  const page = read('frontend/src/pages/AdminMessages.jsx');
  const branches = [...page.matchAll(/String\(message\.subject \|\| ''\)\.toLowerCase\(\) === 'system'/g)];
  assert.ok(branches.length >= 2);
  assert.doesNotMatch(page, /removalEvent \? <UserMinus/);
  assert.doesNotMatch(page, /border-amber-200 bg-amber-50 text-amber-800/);
  assert.match(page, /text-center text-xs font-medium text-stone-500/);
});
