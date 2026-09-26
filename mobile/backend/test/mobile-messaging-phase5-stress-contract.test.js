'use strict';
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const mobileRoot = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(mobileRoot, rel), 'utf8');

test('mobile history remains batched instead of loading an entire long chat', () => {
  const service = read('frontend/lib/features/messaging/data/services/message_service.dart');
  assert.match(service, /historyBatchSize\s*=\s*30/);
  assert.match(service, /fetchOlderRoomThread/);
  assert.match(service, /beforeSentAt/);
  assert.match(service, /beforeMessageId/);
});

test('mobile duplicate cache is bounded during large realtime bursts', () => {
  const provider = read('frontend/lib/features/messaging/presentation/providers/messaging_provider.dart');
  assert.match(provider, /_maxRecentRealtimeMessageIds = 200/);
  assert.match(provider, /while \(_recentRealtimeMessageOrder\.length > _maxRecentRealtimeMessageIds\)/);
});

test('mobile stale async results are rejected after rapid thread switches', () => {
  const provider = read('frontend/lib/features/messaging/presentation/providers/messaging_provider.dart');
  assert.match(provider, /final revision = _threadRevision/);
  assert.match(provider, /revision != _threadRevision/);
});

test('mobile older-message loading protects scroll position and overlapping requests', () => {
  const screen = read('frontend/lib/features/messaging/presentation/screens/messaging_screen.dart');
  assert.match(screen, /_historyRequestGeneration/);
  assert.match(screen, /requestGeneration != _historyRequestGeneration/);
  assert.match(screen, /oldOffset/);
  assert.match(screen, /jumpTo\(target\)/);
});
