const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { EventEmitter } = require('node:events');

const express = require('express');
const jwt = require('jsonwebtoken');

const messageServicePath = require.resolve('../services/messageService');
const messageServiceStub = {
  fetchConversations: async () => [],
  fetchConversationMessages: async () => [],
  markConversationRead: async () => [],
  sendMessage: async () => ({}),
  fetchRooms: async () => [],
  createRoom: async () => ({}),
  fetchRoomMessages: async () => [],
  sendRoomMessage: async () => ({}),
  addRoomMembers: async () => ({}),
  markRoomMessagesRead: async () => [],
  fetchScholarMembers: async () => [],
};

require.cache[messageServicePath] = {
  id: messageServicePath,
  filename: messageServicePath,
  loaded: true,
  exports: messageServiceStub,
};

const messageRoutes = require('../routes/messageRoutes');
const messageService = require('../services/messageService');

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/messages', messageRoutes);

  app.use((err, _req, res, _next) => {
    res.status(err.statusCode || 500).json({
      message: err.message || 'Internal error',
      error: err.message || 'Internal error',
    });
  });

  return app;
}

function createHttpRequest({
  method = 'GET',
  path = '/',
  headers = {},
  body = null,
}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = path;
  req.originalUrl = path;
  req.headers = headers;
  req.socket = new EventEmitter();
  req.connection = req.socket;

  process.nextTick(() => {
    if (body !== null) {
      req.emit('data', Buffer.from(body));
    }
    req.emit('end');
  });

  return req;
}

function createHttpResponse() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.body = '';

  res.status = function status(code) {
    res.statusCode = code;
    return res;
  };

  res.setHeader = function setHeader(name, value) {
    res.headers[String(name).toLowerCase()] = value;
  };

  res.getHeader = function getHeader(name) {
    return res.headers[String(name).toLowerCase()];
  };

  res.json = function json(payload) {
    res.setHeader('content-type', 'application/json');
    res.body = JSON.stringify(payload);
    res.emit('finish');
    return res;
  };

  res.send = function send(payload) {
    res.body = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload);
    res.emit('finish');
    return res;
  };

  res.end = function end(payload) {
    if (payload !== undefined) {
      res.send(payload);
      return res;
    }
    res.emit('finish');
    return res;
  };

  return res;
}

async function dispatch(app, { method, path, token }) {
  const req = createHttpRequest({
    method,
    path,
    headers: token
      ? {
          authorization: `Bearer ${token}`,
        }
      : {},
  });
  const res = createHttpResponse();

  await new Promise((resolve, reject) => {
    res.once('finish', resolve);
    res.once('error', reject);
    app.handle(req, res);
  });

  return res;
}

test('GET /api/messages/conversations/:counterpartyId returns authenticated conversation data', async () => {
  const previous = messageService.fetchConversationMessages;
  messageService.fetchConversationMessages = async (currentUserId, counterpartyId) => [
    {
      message_id: 'msg-1',
      sender_id: currentUserId,
      receiver_id: counterpartyId,
      message_body: 'Hello from fixtures',
      sent_at: '2026-07-10T00:00:00.000Z',
      is_read: false,
    },
  ];

  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const token = jwt.sign({ userId: 'user-1', role: 'student' }, process.env.JWT_SECRET);

  const app = createTestApp();
  const res = await dispatch(app, {
    method: 'GET',
    path: '/api/messages/conversations/user-2',
    token,
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), {
    items: [
      {
        message_id: 'msg-1',
        sender_id: 'user-1',
        receiver_id: 'user-2',
        message_body: 'Hello from fixtures',
        sent_at: '2026-07-10T00:00:00.000Z',
        is_read: false,
      },
    ],
  });

  messageService.fetchConversationMessages = previous;
});

test('GET /api/messages/rooms/:roomId/messages returns authenticated room data', async () => {
  const previous = messageService.fetchRoomMessages;
  messageService.fetchRoomMessages = async (currentUserId, roomId) => [
    {
      message_id: 'room-msg-1',
      sender_id: currentUserId,
      room_id: roomId,
      message_body: 'Room hello',
      sent_at: '2026-07-10T01:00:00.000Z',
      is_read: false,
    },
  ];

  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const token = jwt.sign({ userId: 'user-1', role: 'student' }, process.env.JWT_SECRET);

  const app = createTestApp();
  const res = await dispatch(app, {
    method: 'GET',
    path: '/api/messages/rooms/room-1/messages',
    token,
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), {
    items: [
      {
        message_id: 'room-msg-1',
        sender_id: 'user-1',
        room_id: 'room-1',
        message_body: 'Room hello',
        sent_at: '2026-07-10T01:00:00.000Z',
        is_read: false,
      },
    ],
  });

  messageService.fetchRoomMessages = previous;
});

test('GET /api/messages/conversations/:counterpartyId rejects missing auth', async () => {
  const app = createTestApp();
  const res = await dispatch(app, {
    method: 'GET',
    path: '/api/messages/conversations/user-2',
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(JSON.parse(res.body), {
    message: 'No token, authorization denied',
  });
});
