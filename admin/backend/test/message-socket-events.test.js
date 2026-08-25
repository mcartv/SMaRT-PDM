const test = require('node:test');
const assert = require('node:assert/strict');

const socketEvents = require('../utils/socketEvents');

test('messageCreated emits both current and legacy socket events with identical payloads', () => {
  const emissions = [];
  const io = {
    emit(eventName, payload) {
      emissions.push({ eventName, payload });
    },
  };

  const payload = {
    message_id: 'msg-1',
    sender_id: 'user-1',
    receiver_id: 'user-2',
    room_id: null,
    subject: null,
    message_body: 'Hello',
    sent_at: '2026-07-10T00:00:00.000Z',
    is_read: false,
    created_at: '2026-07-10T00:00:00.000Z',
  };

  socketEvents.messageCreated(io, payload);

  assert.deepEqual(emissions, [
    { eventName: 'message:new', payload },
    { eventName: 'message:created', payload },
  ]);
});
