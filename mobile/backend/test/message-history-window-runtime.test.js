'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const servicePath = path.resolve(__dirname, '../services/messageHistoryService.js');

function loadService() {
  const originalLoad = Module._load;
  Module._load = function patched(request, parent, isMain) {
    if (request === '../config/db' && parent?.filename === servicePath) {
      return { query: async () => ({ rows: [] }) };
    }
    if (request === './messageService' && parent?.filename === servicePath) {
      return { resolveFixedAdminUserId: async () => '00000000-0000-4000-8000-000000000001' };
    }
    if (request === './avatarService' && parent?.filename === servicePath) {
      return { resolveAvatarUrl: async (value) => value };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[servicePath];
    return require(servicePath);
  } finally {
    Module._load = originalLoad;
  }
}

test('normalizes requested batch size to 30 default and 50 maximum', () => {
  const service = loadService();
  assert.equal(service.normalizeLimit(undefined), 30);
  assert.equal(service.normalizeLimit('0'), 30);
  assert.equal(service.normalizeLimit('30'), 30);
  assert.equal(service.normalizeLimit('50'), 50);
  assert.equal(service.normalizeLimit('5000'), 50);
});

test('cursor requires sent_at and message_id together', () => {
  const service = loadService();
  const cursor = service.normalizeCursor({
    beforeSentAt: '2026-09-26T06:00:00.000Z',
    beforeMessageId: '123e4567-e89b-42d3-a456-426614174000',
  });
  assert.deepEqual(cursor, {
    sentAt: '2026-09-26T06:00:00.000Z',
    messageId: '123e4567-e89b-42d3-a456-426614174000',
  });
  assert.equal(service.normalizeCursor({}), null);
  assert.throws(
    () => service.normalizeCursor({ beforeSentAt: '2026-09-26T06:00:00.000Z' }),
    /provided together/
  );
});
