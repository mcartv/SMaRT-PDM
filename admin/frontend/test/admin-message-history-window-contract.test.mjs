import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(frontendRoot, 'src/pages/AdminMessages.jsx'), 'utf8');

test('admin messaging requests 30-message cursor windows for private and group chats', () => {
  assert.match(source, /const MESSAGE_BATCH_SIZE = 30/);
  assert.match(source, /view: 'window'/);
  assert.match(source, /limit: String\(MESSAGE_BATCH_SIZE\)/);
  assert.match(source, /before: history\.nextCursor/);
});

test('older messages merge into the open history without replacing realtime messages', () => {
  assert.match(source, /mergeMessageCollections/);
  assert.match(source, /setMessages\(\(current\) => mergeMessageCollections\(olderItems, current\)\)/);
  assert.match(source, /suppressNextAutoScrollRef\.current = true/);
});

test('scroll position is preserved when older messages are prepended', () => {
  assert.match(source, /previousScrollHeight/);
  assert.match(source, /previousScrollTop/);
  assert.match(source, /currentContainer\.scrollTop = previousScrollTop \+ addedHeight/);
});

test('group member refresh uses the dedicated members endpoint', () => {
  assert.match(source, /rooms\/\$\{normalizedRoomId\}\/members/);
  const memberFunction = source.slice(
    source.indexOf('const fetchRoomMembers = useCallback'),
    source.indexOf('const loadOlderMessages = useCallback')
  );
  assert.doesNotMatch(memberFunction, /normalizedRoomId\}\/messages/);
});

test('silent realtime/fallback sync merges only the newest window instead of replacing loaded history', () => {
  assert.match(source, /if \(!silent\) return items[\s\S]*mergeMessageCollections\(current, items\)/);
  assert.match(source, /fetchRoomMessages\(roomId, \{ silent: true \}\)/);
});

test('message entry animation respects reduced-motion preferences', () => {
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /node\.animate\(/);
  assert.match(source, /duration: 170/);
});
