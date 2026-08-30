'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('Flutter realtime reads the canonical JWT session key', () => {
  const source = read('frontend/lib/core/realtime/mobile_realtime_service.dart');
  assert.match(source, /prefs\.getString\('jwt_token'\)/);
  assert.match(source, /void _dispatchEvent\(MobileRealtimeEvent event\)/);
});

test('messaging provider authenticates Socket.IO with the same REST session', () => {
  const source = read('frontend/lib/features/messaging/presentation/providers/messaging_provider.dart');
  assert.match(source, /MobileRealtimeService\.instance\.connect\(/);
  assert.match(source, /token:\s*session\.token/);
  assert.match(source, /userId:\s*session\.userId/);
  assert.match(source, /_ensureRealtimeListener\(\);[\s\S]*MobileRealtimeService\.instance\.connect\(/);
});

test('mobile messaging consumes room/conversation compatibility events', () => {
  const events = read('frontend/lib/core/realtime/mobile_realtime_events.dart');
  const route = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'internalRealtimeRoutes.js'),
    'utf8'
  );

  for (const eventName of [
    'conversation:updated',
    'room:updated',
    'room:archived',
    'room:restored',
  ]) {
    assert.match(events, new RegExp(eventName.replace(':', '\\:')));
    assert.match(route, new RegExp(eventName.replace(':', '\\:')));
  }
});
