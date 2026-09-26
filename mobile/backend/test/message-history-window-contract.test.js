'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const service = fs.readFileSync(path.join(root, 'services/messageHistoryService.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'routes/messageRoutes.js'), 'utf8');

function source(rel) {
  return fs.readFileSync(path.resolve(root, '..', 'frontend', rel), 'utf8');
}

test('mobile history API is bounded and cursor ordered', () => {
  assert.match(service, /DEFAULT_BATCH_SIZE\s*=\s*30/);
  assert.match(service, /MAX_BATCH_SIZE\s*=\s*50/);
  assert.match(service, /\(m\.sent_at, m\.message_id\)\s*</);
  assert.match(service, /ORDER BY m\.sent_at DESC, m\.message_id DESC/);
  assert.match(service, /LIMIT \$\{limitRef\}::int/);
});

test('mobile history endpoints are separate from legacy messaging routes', () => {
  assert.match(routes, /router\.get\('\/thread\/window'/);
  assert.match(routes, /router\.get\('\/rooms\/:roomId\/window'/);
  assert.match(routes, /router\.get\('\/rooms\/:roomId\/members'/);
  assert.match(routes, /router\.post\('\/thread'/);
  assert.match(routes, /router\.post\('\/rooms\/:roomId\/send'/);
});

test('flutter requests latest 30 and upward cursor batches', () => {
  const messageService = source('lib/features/messaging/data/services/message_service.dart');
  const screen = source('lib/features/messaging/presentation/screens/messaging_screen.dart');

  assert.match(messageService, /historyBatchSize\s*=\s*30/);
  assert.match(messageService, /beforeSentAt/);
  assert.match(messageService, /beforeMessageId/);
  assert.match(messageService, /fetchOlderThread/);
  assert.match(messageService, /fetchOlderRoomThread/);

  assert.match(screen, /remainingToOlderEdge\s*<=\s*220/);
  assert.match(screen, /_loadOlderMessages\(\)/);
  assert.match(screen, /final target = oldOffset\.clamp/);
  assert.match(screen, /Duration\(seconds:\s*20\)/);
  assert.match(screen, /Duration\(milliseconds:\s*170\)/);
  assert.match(screen, /disableAnimations/);
});
