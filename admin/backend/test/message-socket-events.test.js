const test = require('node:test');
const assert = require('node:assert/strict');

const socketEvents = require('../utils/socketEvents');

function createIo(emissions) {
  return {
    emit(eventName, payload) {
      emissions.push({ target: 'global', eventName, payload });
    },
    to(roomName) {
      return {
        emit(eventName, payload) {
          emissions.push({ target: roomName, eventName, payload });
        },
      };
    },
  };
}

test('messageCreated emits both current and legacy socket events with identical payloads', () => {
  const emissions = [];
  const io = createIo(emissions);

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
    { target: 'global', eventName: 'message:new', payload },
    { target: 'global', eventName: 'message:created', payload },
  ]);
});

test('messageCreated targets user rooms once for each supported event', () => {
  const emissions = [];
  const io = createIo(emissions);
  const payload = { message_id: 'msg-2', message_body: 'Targeted' };

  socketEvents.messageCreated(io, payload, { targetUserIds: ['user-1', 'user-2'] });

  assert.deepEqual(emissions.map(({ target, eventName }) => [target, eventName]), [
    ['user:user-1', 'message:new'],
    ['user:user-2', 'message:new'],
    ['user:user-1', 'message:created'],
    ['user:user-2', 'message:created'],
  ]);
  emissions.forEach((entry) => assert.equal(entry.payload, payload));
});
