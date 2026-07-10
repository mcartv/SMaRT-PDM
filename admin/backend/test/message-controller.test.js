const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = require.resolve('../services/messageService');
const socketEventsPath = require.resolve('../utils/socketEvents');

const messageServiceStub = {
  fetchConversationMessages: async () => [],
  fetchRoomMessages: async () => [],
  sendMessage: async () => ({}),
};

const socketEventsStub = {
  messageCreated: () => {},
};

require.cache[servicePath] = {
  id: servicePath,
  filename: servicePath,
  loaded: true,
  exports: messageServiceStub,
};

require.cache[socketEventsPath] = {
  id: socketEventsPath,
  filename: socketEventsPath,
  loaded: true,
  exports: socketEventsStub,
};

const controller = require('../controllers/messageController');

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = function status(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function json(body) {
    this.body = body;
    return this;
  };
  return res;
}

test('getConversationMessages rejects unauthenticated requests', async () => {
  const req = { user: null, params: { counterpartyId: 'user-2' } };
  const res = mockRes();

  await controller.getConversationMessages(req, res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { message: 'Unauthorized' });
});

test('getConversationMessages returns service items', async () => {
  messageServiceStub.fetchConversationMessages = async () => [
    { message_id: 'msg-1', message_body: 'Hello' },
  ];

  const req = {
    user: { userId: 'user-1' },
    params: { counterpartyId: 'user-2' },
  };
  const res = mockRes();

  await controller.getConversationMessages(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    items: [{ message_id: 'msg-1', message_body: 'Hello' }],
  });
});

test('getRoomMessages rejects unauthenticated requests', async () => {
  const req = { user: null, params: { roomId: 'room-1' } };
  const res = mockRes();

  await controller.getRoomMessages(req, res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { message: 'Unauthorized' });
});

test('sendMessage emits both socket events from one payload', async () => {
  const emissions = [];
  messageServiceStub.sendMessage = async () => ({
    message_id: 'msg-1',
    message_body: 'Hello',
    sent_at: '2026-07-10T00:00:00.000Z',
    is_read: false,
  });
  socketEventsStub.messageCreated = (io, payload) => {
    io.emit('message:new', payload);
    io.emit('message:created', payload);
  };

  const req = {
    user: { userId: 'user-1' },
    params: { counterpartyId: 'user-2' },
    body: { messageBody: 'Hello' },
    app: {
      get(key) {
        if (key === 'io') {
          return {
            emit(eventName, payload) {
              emissions.push({ eventName, payload });
            },
          };
        }

        return null;
      },
    },
  };
  const res = mockRes();

  await controller.sendMessage(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(emissions.length, 2);
  assert.deepEqual(emissions.map((item) => item.eventName), [
    'message:new',
    'message:created',
  ]);
  assert.deepEqual(emissions[0].payload, emissions[1].payload);
});
