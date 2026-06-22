import 'package:smartpdm_mobileapp/shared/models/chat_message.dart';
import 'package:smartpdm_mobileapp/core/networking/api_client.dart';

class MessageThreadResult {
  final String counterpartyId;
  final List<ChatMessage> items;

  const MessageThreadResult({
    required this.counterpartyId,
    required this.items,
  });
}

class MessageReadResult {
  final int updatedCount;
  final List<String> messageIds;

  const MessageReadResult({
    required this.updatedCount,
    required this.messageIds,
  });
}

class ChatRoom {
  final String roomId;
  final String roomName;

  const ChatRoom({required this.roomId, required this.roomName});

  factory ChatRoom.fromJson(Map<String, dynamic> json) {
    return ChatRoom(
      roomId:
          json['roomId']?.toString() ??
          json['room_id']?.toString() ??
          '',
      roomName:
          json['roomName']?.toString() ??
          json['room_name']?.toString() ??
          'Unknown Group',
    );
  }
}

class MessageService {
  MessageService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<MessageThreadResult> fetchThread() async {
    try {
      final response = await _apiClient.getObject('/api/messages/thread');
      return MessageThreadResult(
        counterpartyId: response['counterpartyId']?.toString() ?? '',
        items: _parseItems(response['items']),
      );
    } catch (_) {
      final conversations = await _fetchConversationList();
      if (conversations.isEmpty) {
        return const MessageThreadResult(counterpartyId: '', items: []);
      }

      final preferred = _pickPreferredConversation(conversations);
      final counterpartyId =
          preferred['counterparty_id']?.toString().trim() ?? '';

      if (counterpartyId.isEmpty) {
        return const MessageThreadResult(counterpartyId: '', items: []);
      }

      final response = await _apiClient.getObject(
        '/api/messages/conversations/$counterpartyId',
      );

      return MessageThreadResult(
        counterpartyId: counterpartyId,
        items: _parseItems(response['items']),
      );
    }
  }

  Future<ChatMessage> sendThreadMessage(String messageBody) async {
    try {
      final response = await _apiClient.postJson(
        '/api/messages/thread',
        body: {'messageBody': messageBody},
      );

      return ChatMessage.fromJson(response);
    } catch (_) {
      final conversations = await _fetchConversationList();
      if (conversations.isEmpty) {
        rethrow;
      }

      final preferred = _pickPreferredConversation(conversations);
      final counterpartyId =
          preferred['counterparty_id']?.toString().trim() ?? '';
      if (counterpartyId.isEmpty) {
        rethrow;
      }

      final response = await _apiClient.postJson(
        '/api/messages/conversations/$counterpartyId',
        body: {'messageBody': messageBody},
      );

      return ChatMessage.fromJson(response);
    }
  }

  Future<MessageReadResult> markThreadRead({String? counterpartyId}) async {
    try {
      final response = await _apiClient.patchJson('/api/messages/thread/read');
      return MessageReadResult(
        updatedCount: (response['updatedCount'] as num?)?.toInt() ?? 0,
        messageIds: ((response['messageIds'] as List<dynamic>?) ?? const [])
            .map((item) => item.toString())
            .where((item) => item.isNotEmpty)
            .toList(),
      );
    } catch (_) {
      final candidateId = (counterpartyId ?? '').trim();
      final targetCounterpartyId = candidateId.isNotEmpty
          ? candidateId
          : _lastConversationCounterpartyId;

      if (targetCounterpartyId.isEmpty) {
        return const MessageReadResult(updatedCount: 0, messageIds: []);
      }

      final response = await _apiClient.patchJson(
        '/api/messages/conversations/$targetCounterpartyId/read',
      );

      final ids = ((response['messageIds'] as List<dynamic>?) ?? const [])
          .map((item) => item.toString())
          .where((item) => item.isNotEmpty)
          .toList();

      return MessageReadResult(updatedCount: ids.length, messageIds: ids);
    }
  }

  Future<int> fetchUnreadCount() async {
    try {
      final response = await _apiClient.getObject('/api/messages/unread-count');
      return (response['unreadCount'] as num?)?.toInt() ?? 0;
    } catch (_) {
      final conversations = await _fetchConversationList();
      int total = 0;
      for (final conversation in conversations) {
        total += (conversation['unread_count'] as num?)?.toInt() ?? 0;
      }
      return total;
    }
  }

  Future<List<ChatRoom>> fetchGroups() async {
    final items = await _getItems('/api/messages/rooms');
    return items
        .map((item) => ChatRoom.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<List<ChatMessage>> fetchRoomThread(String roomId) async {
    try {
      final response = await _apiClient.getObject(
        '/api/messages/rooms/$roomId/thread',
      );
      return _parseItems(response['items']);
    } catch (_) {
      final response = await _apiClient.getObject(
        '/api/messages/rooms/$roomId/messages',
      );
      return _parseItems(response['items']);
    }
  }

  Future<ChatMessage> sendRoomMessage(String roomId, String messageBody) async {
    try {
      final response = await _apiClient.postJson(
        '/api/messages/rooms/$roomId/send',
        body: {'messageBody': messageBody},
      );
      return ChatMessage.fromJson(response);
    } catch (_) {
      final response = await _apiClient.postJson(
        '/api/messages/rooms/$roomId/messages',
        body: {'messageBody': messageBody},
      );
      return ChatMessage.fromJson(response);
    }
  }

  Future<void> markRoomThreadRead(String roomId) async {
    await _apiClient.patchJson('/api/messages/rooms/$roomId/read');
  }

  List<ChatMessage> _parseItems(dynamic rawItems) {
    final items = rawItems as List<dynamic>? ?? const [];
    final parsedItems = <ChatMessage>[];

    for (final item in items) {
      if (item is Map<String, dynamic>) {
        parsedItems.add(ChatMessage.fromJson(item));
        continue;
      }

      if (item is Map) {
        parsedItems.add(
          ChatMessage.fromJson(
            item.map((key, value) => MapEntry(key.toString(), value)),
          ),
        );
      }
    }

    return parsedItems.where((item) => item.messageId.isNotEmpty).toList();
  }

  String _lastConversationCounterpartyId = '';

  Future<List<Map<String, dynamic>>> _fetchConversationList() async {
    final response = await _apiClient.getObject('/api/messages/conversations');
    final items = response['items'] as List<dynamic>? ?? const [];

    return items
        .where((item) => item is Map)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  Map<String, dynamic> _pickPreferredConversation(
    List<Map<String, dynamic>> items,
  ) {
    final adminConversation = items.firstWhere(
      (item) =>
          (item['role']?.toString().toLowerCase() ?? '').contains('admin'),
      orElse: () => items.first,
    );

    _lastConversationCounterpartyId =
        adminConversation['counterparty_id']?.toString().trim() ?? '';
    return adminConversation;
  }

  Future<List<dynamic>> _getItems(String path) async {
    try {
      return await _apiClient.getList(path);
    } catch (_) {
      final response = await _apiClient.getObject(path);
      final items = response['items'] as List<dynamic>?;
      return items ?? const [];
    }
  }
}
