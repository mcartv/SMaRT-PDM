
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
      role: 'student',
    );
  }
}

class _FakeMessagingSocket implements MessagingSocket {
  bool _connected = false;
  MessagingSocketHandler? _messageNewHandler;
  MessagingSocketHandler? _messageReadHandler;
  void Function(dynamic)? _connectHandler;

  @override
  bool get connected => _connected;

  @override
  void connect() {
    _connected = true;
    _connectHandler?.call(null);
  }

  @override
  void disconnect() {
    _connected = false;
  }

  @override
  void dispose() {}

  @override
  void onConnect(void Function(dynamic) handler) {
    _connectHandler = handler;
  }

  @override
  void onDisconnect(void Function(dynamic) handler) {}

  @override
  void on(String event, MessagingSocketHandler handler) {
    if (event == 'message:new') {
      _messageNewHandler = handler;
    }
    if (event == 'message:read') {
      _messageReadHandler = handler;
    }
  }

  void emitMessageNew(Map<String, dynamic> payload) {
    _messageNewHandler?.call(payload);
  }

  void emitMessageRead(Map<String, dynamic> payload) {
    _messageReadHandler?.call(payload);
  }
}

class _FakeMessageService extends MessageService {
  _FakeMessageService(this.socket);

  final _FakeMessagingSocket socket;

  @override
  Future<MessageThreadResult> fetchThread() async {
    return MessageThreadResult(
      counterpartyId: 'user-2',
      items: [
        ChatMessage.fromJson({
          'message_id': 'msg-1',
          'sender_id': 'user-2',
          'receiver_id': 'user-1',
          'message_body': 'Original',
          'sent_at': '2026-07-10T00:00:00.000Z',
          'is_read': false,
        }),
      ],
    );
  }

  @override
  Future<MessageReadResult> markThreadRead({String? counterpartyId}) async {
    return const MessageReadResult(updatedCount: 1, messageIds: ['msg-1']);
  }

  @override
  Future<void> markRoomThreadRead(String roomId) async {}

  @override
  Future<int> fetchUnreadCount() async => 1;

  @override
  Future<List<ChatRoom>> fetchGroups() async {
    return const [
      ChatRoom(roomId: 'room-1', roomName: 'Room 1', unreadCount: 0),
    ];
  }

  @override
  Future<List<ChatMessage>> fetchRoomThread(String roomId) async {
    return [
      ChatMessage.fromJson({
        'message_id': 'room-msg-1',
        'sender_id': 'user-2',
        'room_id': roomId,
        'message_body': 'Room original',
        'sent_at': '2026-07-10T00:00:00.000Z',
        'is_read': false,
      }),
    ];
  }

  @override
  Future<ChatMessage> sendThreadMessage(String messageBody) async {
    return ChatMessage.fromJson({
      'message_id': 'sent-msg',
      'sender_id': 'user-1',
      'receiver_id': 'user-2',
      'message_body': messageBody,
      'sent_at': '2026-07-10T00:00:00.000Z',
      'is_read': false,
    });
  }

  @override
  Future<ChatMessage> sendRoomMessage(String roomId, String messageBody) async {
    return ChatMessage.fromJson({
      'message_id': 'sent-room-msg',
      'sender_id': 'user-1',
      'room_id': roomId,
      'message_body': messageBody,
      'sent_at': '2026-07-10T00:00:00.000Z',
      'is_read': false,
    });
  }
}

MessagingProvider _createProvider(_FakeMessagingSocket socket, _FakeMessageService service) {
  return MessagingProvider(
    messageService: service,
    sessionService: const _FakeSessionService(),
    socketFactory: (_) => socket,
  );
}

void main() {
  test('control test completes', () {
    expect(true, isTrue);
  });

  test('MessagingProvider handles active private socket updates', () async {
    final socket = _FakeMessagingSocket();
    final service = _FakeMessageService(socket);
    final provider = _createProvider(socket, service);
    addTearDown(provider.dispose);

    await provider.enterThread();
    expect(provider.counterpartyId, 'user-2');
    expect(provider.messages, hasLength(1));

    const socketPayload = {
      'message_id': 'msg-2',
      'sender_id': 'user-2',
      'receiver_id': 'user-1',
      'room_id': null,
      'subject': null,
      'message_body': 'Live update',
      'sent_at': '2026-07-10T01:00:00.000Z',
      'is_read': false,
      'attachment_url': null,
    };

    socket.emitMessageNew(socketPayload);
    expect(provider.messages, hasLength(2));

    socket.emitMessageNew(socketPayload);
    expect(
      provider.messages.where((message) => message.messageId == 'msg-2'),
      hasLength(1),
    );

    final parsed = ChatMessage.fromJson(socketPayload);
    expect(parsed.messageId, 'msg-2');
    expect(parsed.senderId, 'user-2');
    expect(parsed.receiverId, 'user-1');
    expect(parsed.messageBody, 'Live update');
  });

  test('MessagingProvider handles inactive room messages and read receipts', () async {
    final socket = _FakeMessagingSocket();
    final service = _FakeMessageService(socket);
    final provider = _createProvider(socket, service);
    addTearDown(provider.dispose);

    await provider.enterRoom('room-1');
    expect(provider.activeGroupId, 'room-1');
    expect(provider.messages, hasLength(1));

    socket.emitMessageNew({
      'message_id': 'room-msg-2',
      'sender_id': 'user-2',
      'receiver_id': null,
      'room_id': 'room-1',
      'subject': null,
      'message_body': 'Group update',
      'sent_at': '2026-07-10T02:00:00.000Z',
      'is_read': false,
      'attachment_url': null,
    });
    expect(
      provider.messages.where((message) => message.messageId == 'room-msg-2'),
      hasLength(1),
    );
    expect(provider.groupUnreadCount('room-1'), 0);

    socket.emitMessageRead({
      'room_id': null,
      'message_ids': ['room-msg-1', 'does-not-match'],
    });
    expect(
      provider.messages.singleWhere((message) => message.messageId == 'room-msg-1').isRead,
      isTrue,
    );
  });
}
