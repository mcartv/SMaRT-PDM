'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const servicePath = path.resolve(__dirname, '../services/messageHistoryService.js');

function makeRows(count, { roomId = null } = {}) {
  const base = Date.parse('2026-09-26T00:00:00.000Z');
  return Array.from({ length: count }, (_, index) => ({
    message_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    sender_id: '11111111-1111-4111-8111-111111111111',
    receiver_id: roomId ? null : '22222222-2222-4222-8222-222222222222',
    room_id: roomId,
    subject: null,
    message_body: `message-${index + 1}`,
    sent_at: new Date(base - index * 1000).toISOString(),
    edited_at: null,
    unsent_at: null,
    unsent_by: null,
    edit_count: 0,
    is_read: true,
    seen_by_counterparty: false,
    seen_by: [],
    attachment_url: null,
    reply_to_message_id: null,
    client_message_id: null,
    reply_message_body: null,
    reply_sender_id: null,
  }));
}

function loadService(queryHandler) {
  delete require.cache[servicePath];
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent?.filename === servicePath && request === '../config/db') {
      return { query: queryHandler };
    }
    if (parent?.filename === servicePath && request === './messageService') {
      return {
        fetchUserSummary: async (userId) => ({
          user_id: userId,
          display_name: 'Test User',
          profile_photo_url: null,
          avatar_url: null,
          email: 'test@example.com',
        }),
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(servicePath);
  } finally {
    Module._load = originalLoad;
  }
}

test('private history returns newest 30 in chronological display order with an older cursor', async () => {
  const calls = [];
  const rows = makeRows(31);
  const service = loadService(async (sql, values) => {
    calls.push({ sql, values });
    return { rows };
  });

  const result = await service.fetchPrivateWindow(
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    { limit: 30 }
  );

  assert.equal(result.items.length, 30);
  assert.equal(result.pagination.hasMore, true);
  assert.ok(result.pagination.nextCursor);
  assert.equal(result.items[0].message_body, 'message-30');
  assert.equal(result.items.at(-1).message_body, 'message-1');
  assert.match(calls[0].sql, /ORDER BY m\.sent_at DESC, m\.message_id DESC/);
  assert.equal(calls[0].values.at(-1), 31);
});

test('older cursor becomes a deterministic sent_at + message_id tuple predicate', async () => {
  let firstCursor = '';
  {
    const service = loadService(async () => ({ rows: makeRows(31) }));
    const first = await service.fetchPrivateWindow('u1', 'u2', { limit: 30 });
    firstCursor = first.pagination.nextCursor;
  }

  const calls = [];
  const service = loadService(async (sql, values) => {
    calls.push({ sql, values });
    return { rows: makeRows(5) };
  });
  await service.fetchPrivateWindow('u1', 'u2', { limit: 30, before: firstCursor });

  assert.match(calls[0].sql, /\(m\.sent_at, m\.message_id\) < \(\$3::timestamptz, \$4::uuid\)/);
  assert.equal(calls[0].values.length, 5);
});

test('requested batch sizes are capped at 50', async () => {
  const calls = [];
  const service = loadService(async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [] };
  });

  await service.fetchPrivateWindow('u1', 'u2', { limit: 9999 });
  assert.equal(calls[0].values.at(-1), 51);
});

test('group history checks membership before querying the message window', async () => {
  const calls = [];
  const service = loadService(async (sql, values) => {
    calls.push({ sql, values });
    if (/FROM chat_room_members/.test(sql)) return { rows: [{ ok: 1 }] };
    return { rows: makeRows(2, { roomId: 'room-1' }) };
  });

  const result = await service.fetchRoomWindow('user-1', 'room-1', { limit: 30 });
  assert.equal(result.items.length, 2);
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /FROM chat_room_members/);
  assert.match(calls[1].sql, /FROM messages m/);
});

test('group history rejects non-members before exposing messages', async () => {
  const service = loadService(async (sql) => {
    if (/FROM chat_room_members/.test(sql)) return { rows: [] };
    throw new Error('message query must not run');
  });

  await assert.rejects(
    () => service.fetchRoomWindow('outsider', 'room-1', { limit: 30 }),
    (error) => error?.statusCode === 403
  );
});
