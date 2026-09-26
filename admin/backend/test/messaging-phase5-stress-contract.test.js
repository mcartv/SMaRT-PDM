'use strict';
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const project = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(project, rel), 'utf8');

test('history remains bounded for very long chats', () => {
  const service = read('backend/services/messageHistoryService.js');
  assert.match(service, /const DEFAULT_BATCH_SIZE = 30/);
  assert.match(service, /const MAX_BATCH_SIZE = 50/);
  assert.match(service, /limit \+ 1/);
});

test('web duplicate guard stays bounded during large realtime bursts', () => {
  const ui = read('frontend/src/pages/AdminMessages.jsx');
  assert.match(ui, /processedIds\.size > 500/);
  assert.match(ui, /slice\(-250\)/);
});

test('rapid conversation switching cancels and invalidates stale requests', () => {
  const ui = read('frontend/src/pages/AdminMessages.jsx');
  assert.match(ui, /messageRequestRef\.current\.controller\?\.abort\(\)/);
  assert.match(ui, /requestId !== messageRequestRef\.current\.sequence/);
  assert.match(ui, /olderMessageRequestRef/);
});

test('older history insertion preserves scroll continuity', () => {
  const ui = read('frontend/src/pages/AdminMessages.jsx');
  assert.match(ui, /previousScrollHeight/);
  assert.match(ui, /currentContainer\.scrollHeight - previousScrollHeight/);
  assert.match(ui, /scrollTop = previousScrollTop \+ addedHeight/);
});
