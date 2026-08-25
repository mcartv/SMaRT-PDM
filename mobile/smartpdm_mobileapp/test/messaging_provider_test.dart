import 'package:flutter_test/flutter_test.dart';

import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/messaging/data/services/message_service.dart';
import 'package:smartpdm_mobileapp/features/messaging/presentation/providers/messaging_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/chat_message.dart';

class _FakeSessionService extends SessionService {
  const _FakeSessionService();

  @override
  Future<SessionUser> getCurrentUser() async {
    return const SessionUser(
      token: 'token-1',
      userId: 'user-1',
      email: 'student@example.com',
      studentId: 'PDM-2024-000001',
      firstName: 'Test',
      lastName: 'Student',
      isVerified: true,
      hasScholarAccess: true,
      role: 'student',
    );
  }
}

class _FakeMessageService extends MessageService {
  int fetchThreadCalls = 0;
  int markThreadReadCalls = 0;
  int fetchGroupsCalls = 0;
  int fetchRoomThreadCalls = 0;
  int sendThreadMessageCalls = 0;
  int sendRoomMessageCalls = 0;
  int markRoomThreadReadCalls = 0;

  @override
  Future<MessageThreadResult> fetchThread() async {
    fetchThreadCalls += 1;

    return MessageThreadResult(
      counterpartyId: 'user-2',
      items: [
        ChatMessage.fromJson({
          'message_id': 'msg-1',
          'sender_id': 'user-2',
          'receiver_id': 'user-1',
          'room_id': null,
          'subject': null,
          'message_body': 'Original private message',
          'sent_at': '2026-07-10T00:00:00.000Z',
          'is_read': false,
          'attachment_url': null,
        }),
      ],
    );
  }

  @override
  Future<MessageReadResult> markThreadRead({String? counterpartyId}) async {
    markThreadReadCalls += 1;

    return const MessageReadResult(updatedCount: 1, messageIds: ['msg-1']);
  }

  @override
  Future<void> markRoomThreadRead(String roomId) async {
    markRoomThreadReadCalls += 1;
  }

  @override
  Future<int> fetchUnreadCount() async {
    return 1;
  }

  @override
  Future<List<ChatRoom>> fetchGroups() async {
    fetchGroupsCalls += 1;

    return const [
      ChatRoom(roomId: 'room-1', roomName: 'Room 1', unreadCount: 0),
    ];
  }

  @override
  Future<List<ChatMessage>> fetchRoomThread(String roomId) async {
    fetchRoomThreadCalls += 1;

    return [
      ChatMessage.fromJson({
        'message_id': 'room-msg-1',
        'sender_id': 'user-2',
        'receiver_id': null,
        'room_id': roomId,
        'subject': null,
        'message_body': 'Original room message',
        'sent_at': '2026-07-10T00:00:00.000Z',
        'is_read': false,
        'attachment_url': null,
      }),
    ];
  }

  @override
  Future<ChatMessage> sendThreadMessage(String messageBody) async {
    sendThreadMessageCalls += 1;

    return ChatMessage.fromJson({
      'message_id': 'sent-msg',
      'sender_id': 'user-1',
      'receiver_id': 'user-2',
      'room_id': null,
      'subject': null,
      'message_body': messageBody,
      'sent_at': '2026-07-10T03:00:00.000Z',
      'is_read': false,
      'attachment_url': null,
    });
  }

  @override
  Future<ChatMessage> sendRoomMessage(String roomId, String messageBody) async {
    sendRoomMessageCalls += 1;

    return ChatMessage.fromJson({
      'message_id': 'sent-room-msg',
      'sender_id': 'user-1',
      'receiver_id': null,
      'room_id': roomId,
      'subject': null,
      'message_body': messageBody,
      'sent_at': '2026-07-10T04:00:00.000Z',
      'is_read': false,
      'attachment_url': null,
    });
  }
}

MessagingProvider _createProvider(_FakeMessageService messageService) {
  return MessagingProvider(
    messageService: messageService,
    sessionService: const _FakeSessionService(),

    // Prevent the unit test from creating a real Socket.io connection.
    enableRealtime: false,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('control test completes', () {
    expect(true, isTrue);
  });

  test('MessagingProvider loads the private conversation', () async {
    final service = _FakeMessageService();
    final provider = _createProvider(service);

    addTearDown(provider.dispose);

    await provider.enterThread();

    expect(provider.activeGroupId, isNull);
    expect(provider.counterpartyId, 'user-2');
    expect(provider.messages, hasLength(1));
    expect(provider.messages.first.messageId, 'msg-1');
    expect(provider.messages.first.messageBody, 'Original private message');

    expect(service.fetchThreadCalls, greaterThanOrEqualTo(1));
    expect(service.markThreadReadCalls, 1);

    // enterThread marks the loaded conversation as read.
    expect(provider.messages.first.isRead, isTrue);
  });

  test('MessagingProvider sends a private message', () async {
    final service = _FakeMessageService();
    final provider = _createProvider(service);

    addTearDown(provider.dispose);

    await provider.enterThread();
    await provider.sendMessage('Test private reply');

    expect(service.sendThreadMessageCalls, 1);

    final sentMessage = provider.messages.singleWhere(
      (message) => message.messageId == 'sent-msg',
    );

    expect(sentMessage.senderId, 'user-1');
    expect(sentMessage.receiverId, 'user-2');
    expect(sentMessage.roomId, isNull);
    expect(sentMessage.messageBody, 'Test private reply');
  });

  test('MessagingProvider does not send an empty message', () async {
    final service = _FakeMessageService();
    final provider = _createProvider(service);

    addTearDown(provider.dispose);

    await provider.enterThread();
    await provider.sendMessage('     ');

    expect(service.sendThreadMessageCalls, 0);
  });

  test('MessagingProvider loads a room conversation', () async {
    final service = _FakeMessageService();
    final provider = _createProvider(service);

    addTearDown(provider.dispose);

    await provider.enterRoom('room-1');

    expect(provider.activeGroupId, 'room-1');
    expect(provider.messages, hasLength(1));
    expect(provider.messages.first.messageId, 'room-msg-1');
    expect(provider.messages.first.roomId, 'room-1');
    expect(provider.messages.first.messageBody, 'Original room message');

    expect(service.fetchRoomThreadCalls, greaterThanOrEqualTo(1));
    expect(service.markRoomThreadReadCalls, 1);
  });

  test('MessagingProvider sends a room message', () async {
    final service = _FakeMessageService();
    final provider = _createProvider(service);

    addTearDown(provider.dispose);

    await provider.enterRoom('room-1');
    await provider.sendMessage('Test group reply');

    expect(service.sendRoomMessageCalls, 1);

    final sentMessage = provider.messages.singleWhere(
      (message) => message.messageId == 'sent-room-msg',
    );

    expect(sentMessage.senderId, 'user-1');
    expect(sentMessage.roomId, 'room-1');
    expect(sentMessage.messageBody, 'Test group reply');
  });

  test('MessagingProvider loads available chat rooms', () async {
    final service = _FakeMessageService();
    final provider = _createProvider(service);

    addTearDown(provider.dispose);

    await provider.initializeChat();

    expect(provider.rooms, hasLength(1));
    expect(provider.rooms.first.roomId, 'room-1');
    expect(provider.rooms.first.roomName, 'Room 1');
    expect(service.fetchGroupsCalls, 1);
  });

  test('MessagingProvider leaves the currently opened thread', () async {
    final service = _FakeMessageService();
    final provider = _createProvider(service);

    addTearDown(provider.dispose);

    await provider.enterRoom('room-1');

    expect(provider.activeGroupId, 'room-1');
    expect(provider.messages, isNotEmpty);

    provider.leaveThread(notify: false);

    expect(provider.activeGroupId, isNull);
    expect(provider.messages, isEmpty);
  });

  test('ChatMessage parses a valid private message payload', () {
    const payload = {
      'message_id': 'msg-2',
      'sender_id': 'user-2',
      'receiver_id': 'user-1',
      'room_id': null,
      'subject': null,
      'message_body': 'Parsed message',
      'sent_at': '2026-07-10T01:00:00.000Z',
      'is_read': false,
      'attachment_url': null,
    };

    final message = ChatMessage.fromJson(payload);

    expect(message.messageId, 'msg-2');
    expect(message.senderId, 'user-2');
    expect(message.receiverId, 'user-1');
    expect(message.roomId, isNull);
    expect(message.messageBody, 'Parsed message');
    expect(message.isRead, isFalse);
  });
}
