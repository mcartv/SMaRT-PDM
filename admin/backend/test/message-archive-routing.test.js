const test = require('node:test');
const assert = require('node:assert/strict');

const dbPath = require.resolve('../config/db');
const auditLogPath = require.resolve('../services/auditLogService');
const messageServicePath = require.resolve('../services/messageService');
const studentRelayPath = require.resolve('../services/studentRealtimeRelayService');

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async () => ({ rows: [], rowCount: 0 }),
  },
};

require.cache[auditLogPath] = {
  id: auditLogPath,
  filename: auditLogPath,
  loaded: true,
  exports: {
    logAudit: async () => {},
  },
};

const calls = {
  fetchArchivedThreads: [],
  archiveConversation: [],
  restoreConversation: [],
  archiveRoom: [],
  restoreRoom: [],
};

const messageServiceStub = {
  fetchArchivedThreads: async (userId) => {
    calls.fetchArchivedThreads.push([userId]);
    return [
      {
        archive_id: 'archive-1',
        thread_type: 'private',
        counterparty_id: 'user-2',
        archived_at: '2026-08-10T12:00:00.000Z',
      },
    ];
  },
  archiveConversation: async (userId, counterpartyId) => {
    calls.archiveConversation.push([userId, counterpartyId]);
    return {
      archive_id: 'archive-private',
      user_id: userId,
      thread_type: 'private',
      counterparty_id: counterpartyId,
      room_id: null,
      archived_at: '2026-08-10T12:01:00.000Z',
    };
  },
  restoreConversation: async (userId, counterpartyId) => {
    calls.restoreConversation.push([userId, counterpartyId]);
    return {
      restored: true,
      archive: {
        archive_id: 'archive-private',
      },
      counterparty_id: counterpartyId,
    };
  },
  archiveRoom: async (userId, roomId, options) => {
    calls.archiveRoom.push([userId, roomId, options]);
    return {
      archive_id: 'archive-room',
      user_id: userId,
      thread_type: 'group',
      counterparty_id: null,
      room_id: roomId,
      archived_at: '2026-08-10T12:02:00.000Z',
    };
  },
  restoreRoom: async (userId, roomId, options) => {
    calls.restoreRoom.push([userId, roomId, options]);
    return {
      restored: true,
      archive: {
        archive_id: 'archive-room',
      },
      room_id: roomId,
    };
  },
};

require.cache[messageServicePath] = {
  id: messageServicePath,
  filename: messageServicePath,
  loaded: true,
  exports: messageServiceStub,
};

require.cache[studentRelayPath] = {
  id: studentRelayPath,
  filename: studentRelayPath,
  loaded: true,
  exports: {
    relayMessageEvent: async () => ({ ok: true }),
  },
};

const controller = require('../controllers/messageController');

function mockIo() {
  return {
    to() {
      return {
        emit() {},
      };
    },
  };
}

function mockReq({
  userId = 'user-1',
  role = 'admin',
  params = {},
} = {}) {
  return {
    user: {
      userId,
      role,
    },
    params,
    app: {
      get(key) {
        return key === 'io' ? mockIo() : null;
      },
    },
  };
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('archived thread list is loaded from the persisted archive service', async () => {
  calls.fetchArchivedThreads.length = 0;

  const req = mockReq();
  const res = mockRes();

  await controller.getArchivedThreads(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.fetchArchivedThreads.length, 1);
  assert.deepEqual(calls.fetchArchivedThreads[0], ['user-1']);
  assert.equal(res.body.items.length, 1);
  assert.deepEqual(res.body.archived, res.body.items);
});

test('private archive persists before a success response is returned', async () => {
  calls.archiveConversation.length = 0;

  const req = mockReq({
    params: {
      counterpartyId: 'user-2',
    },
  });
  const res = mockRes();

  await controller.archiveConversation(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.archiveConversation, [['user-1', 'user-2']]);
  assert.equal(res.body.success, true);
  assert.equal(res.body.archive.archive_id, 'archive-private');
  assert.equal(res.body.archive.counterparty_id, 'user-2');
});

test('private restore removes the persisted archive before returning success', async () => {
  calls.restoreConversation.length = 0;

  const req = mockReq({
    params: {
      counterpartyId: 'user-2',
    },
  });
  const res = mockRes();

  await controller.restoreConversation(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.restoreConversation, [['user-1', 'user-2']]);
  assert.equal(res.body.success, true);
  assert.equal(res.body.restored, true);
});

test('system admin room archive and restore preserve all-room access', async () => {
  calls.archiveRoom.length = 0;
  calls.restoreRoom.length = 0;

  const archiveReq = mockReq({
    role: 'admin',
    params: {
      roomId: 'room-1',
    },
  });
  const archiveRes = mockRes();

  await controller.archiveRoom(archiveReq, archiveRes);

  assert.equal(archiveRes.statusCode, 200);
  assert.equal(archiveRes.body.success, true);
  assert.deepEqual(calls.archiveRoom, [
    ['user-1', 'room-1', { skipMembershipCheck: true }],
  ]);

  const restoreReq = mockReq({
    role: 'admin',
    params: {
      roomId: 'room-1',
    },
  });
  const restoreRes = mockRes();

  await controller.restoreRoom(restoreReq, restoreRes);

  assert.equal(restoreRes.statusCode, 200);
  assert.equal(restoreRes.body.success, true);
  assert.deepEqual(calls.restoreRoom, [
    ['user-1', 'room-1', { skipMembershipCheck: true }],
  ]);
});

test('department account room archive still requires room membership', async () => {
  calls.archiveRoom.length = 0;

  const req = mockReq({
    role: 'sdo',
    params: {
      roomId: 'room-2',
    },
  });
  const res = mockRes();

  await controller.archiveRoom(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.archiveRoom, [
    ['user-1', 'room-2', { skipMembershipCheck: false }],
  ]);
});
