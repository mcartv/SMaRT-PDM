const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
}

test('mobile message:new and message:created aliases share one message-id guard', () => {
  const source = read('../frontend/lib/features/messaging/presentation/providers/messaging_provider.dart');
  assert.match(source, /case MobileRealtimeEvents\.messageNew:/);
  assert.match(source, /case MobileRealtimeEvents\.messageCreated:/);
  assert.match(source, /!_rememberRealtimeMessage\(message\.messageId\)/);
  assert.match(source, /final Set<String> _recentRealtimeMessageIds/);
});

test('mobile messaging ignores stale thread refresh and read results after navigation', () => {
  const source = read('../frontend/lib/features/messaging/presentation/providers/messaging_provider.dart');
  assert.match(source, /int _threadRevision = 0;/);
  assert.match(source, /_threadRevision \+= 1;/);
  assert.match(source, /revision != _threadRevision/);
  assert.match(source, /_activeGroupId != targetGroupId/);
  assert.match(source, /final targetCounterpartyId = _counterpartyId;/);
});

test('mobile creation aliases do not trigger duplicate authoritative reconciliation', () => {
  const source = read('../frontend/lib/features/messaging/presentation/providers/messaging_provider.dart');
  assert.match(source, /final handled = _handleMessageRealtimeFast\(event\);/);
  assert.match(source, /if \(handled\) \{\s*_scheduleRealtimeMessageReconcile\(\);/s);
  assert.match(source, /!_rememberRealtimeMessage\(message\.messageId\)/);
});

test('mobile private realtime event is isolated to the rendered counterparty', () => {
  const source = read('../frontend/lib/features/messaging/presentation/providers/messaging_provider.dart');
  assert.match(source, /final privateCounterpartyId =/);
  assert.match(source, /final activeCounterpartyId = _counterpartyId\.trim\(\);/);
  assert.match(source, /isCurrentPrivateCounterparty/);
  assert.match(source, /isViewingPrivateThread && isCurrentPrivateCounterparty/);
});

test('mobile message ordering uses message id as deterministic timestamp tie-breaker', () => {
  const source = read('../frontend/lib/features/messaging/presentation/providers/messaging_provider.dart');
  assert.match(source, /final timeComparison = right\.sentAt\.compareTo\(left\.sentAt\);/);
  assert.match(source, /return right\.messageId\.compareTo\(left\.messageId\);/);
});
