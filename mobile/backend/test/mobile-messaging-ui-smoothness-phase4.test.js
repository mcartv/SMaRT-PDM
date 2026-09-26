const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/lib/features/messaging/presentation/screens/messaging_screen.dart'),
  'utf8'
);

test('mobile thread and search transitions are bounded and keyed', () => {
  assert.match(source, /AnimatedSize\([\s\S]*chat-search-open/);
  assert.match(source, /AnimatedSwitcher\([\s\S]*message-thread-\$\{_normalizedRoomId \?\? 'private'\}/);
  assert.match(source, /Duration\(milliseconds: 170\)/);
});

test('mobile history loader and delivery status transition without abrupt layout changes', () => {
  assert.match(source, /ValueKey<String>\('older-loading'\)/);
  assert.match(source, /ValueKey<String>\('older-ready'\)/);
  assert.match(source, /ValueKey<String>\('delivery-visible'\)/);
  assert.match(source, /ValueKey<String>\('delivery-hidden'\)/);
});

test('mobile send control transitions between like, send, and sending states', () => {
  assert.match(source, /ValueKey<String>\('send-loading'\)/);
  assert.match(source, /ValueKey<String>\('send-ready'\)/);
  assert.match(source, /ValueKey<String>\('send-like'\)/);
  assert.match(source, /ScaleTransition\(/);
});
