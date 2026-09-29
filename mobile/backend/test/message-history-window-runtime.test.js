'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const servicePath = path.resolve(__dirname, '../services/messageHistoryService.js');

function loadService({ query = async () => ({ rows: [] }) } = {}) {
  const originalLoad = Module._load;
  Module._load = function patched(request, parent, isMain) {
    if (request === '../config/db' && parent?.filename === servicePath) {
      return { query };
    }
    if (request === './messageService' && parent?.filename === servicePath) {
      return { resolveFixedAdminUserId: async () => '00000000-0000-4000-8000-000000000001' };
    }
    if (request === './avatarService' && parent?.filename === servicePath) {
      return {
        resolveAvatarUrl: async (value) => /^https?:\/\//i.test(value)
          ? value
          : `https://avatar.test/${value}`,
      };
    }
    if (request === './messageReplyCompatibility' && parent?.filename === servicePath) {
      return { enrichReplyContexts: async (items) => items };
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

test('group history resolves profile photos for admin senders', async () => {
  const adminId = '123e4567-e89b-42d3-a456-426614174000';
  const currentUserId = '223e4567-e89b-42d3-a456-426614174000';
  const roomId = '323e4567-e89b-42d3-a456-426614174000';
  const statements = [];
  const service = loadService({
    query: async (sql) => {
      const statement = String(sql);
      statements.push(statement);
      if (statement.includes('SELECT 1') && statement.includes('chat_room_members')) {
        return { rows: [{ exists: 1 }] };
      }
      if (statement.includes('FROM messages m')) {
        return {
          rows: [{
            message_id: '423e4567-e89b-42d3-a456-426614174000',
            sender_id: adminId,
            receiver_id: null,
            room_id: roomId,
            subject: null,
            message_body: 'Hello',
            sent_at: '2026-09-29T01:00:00.000Z',
            is_read: true,
            attachment_url: null,
            unsent_at: null,
            unsent_by: null,
          }],
        };
      }
      if (statement.includes('FROM users u')) {
        return {
          rows: [{
            user_id: adminId,
            username: 'leo',
            email: 'leo@example.test',
            student_first_name: null,
            student_last_name: null,
            student_photo: null,
            admin_first_name: 'Leo Lawrence',
            admin_last_name: 'Galve',
          }],
        };
      }
      if (statement.includes('FROM admin_profiles')) {
        return {
          rows: [{
            user_id: adminId,
            profile_photo_url: 'https://cdn.test/leo.webp',
          }],
        };
      }
      return { rows: [] };
    },
  });

  const window = await service.fetchRoomWindow(currentUserId, roomId);
  assert.ok(
    statements.some((statement) => statement.includes('SELECT user_id, profile_photo_url')),
    `Admin photo query was not executed: ${JSON.stringify(statements)}`
  );
  assert.equal(window.items[0].senderName, 'Leo Lawrence Galve');
  assert.equal(
    window.items[0].senderAvatarUrl,
    'https://cdn.test/leo.webp'
  );

  const source = require('node:fs').readFileSync(servicePath, 'utf8');
  assert.match(source, /row\.student_photo \|\| adminPhotoMap\.get\(row\.user_id\)/);
  assert.match(source, /senderAvatarUrl: profile\?\.avatarUrl \|\| null/);
});
