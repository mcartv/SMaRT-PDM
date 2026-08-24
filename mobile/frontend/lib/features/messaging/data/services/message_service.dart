import 'package:smartpdm_mobileapp/shared/models/chat_message.dart';
import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:flutter/foundation.dart';

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
  final int unreadCount;
  final int memberCount;
  final String lastMessage;
  final DateTime? lastSentAt;

  const ChatRoom({
    required this.roomId,
    required this.roomName,
    this.unreadCount = 0,
    this.memberCount = 0,
    this.lastMessage = '',
    this.lastSentAt,
  });

  factory ChatRoom.fromJson(Map<String, dynamic> json) {
    final rawLastSentAt =
        json['lastSentAt']?.toString() ??
        json['last_sent_at']?.toString() ??
        '';

    return ChatRoom(
      roomId: json['roomId']?.toString() ?? json['room_id']?.toString() ?? '',
      roomName:
          json['roomName']?.toString() ??
          json['room_name']?.toString() ??
          'Unknown Group',
      unreadCount:
          (json['unreadCount'] as num?)?.toInt() ??
          (json['unread_count'] as num?)?.toInt() ??
          0,
      memberCount:
          (json['memberCount'] as num?)?.toInt() ??
          (json['member_count'] as num?)?.toInt() ??
          0,
      lastMessage:
          json['lastMessage']?.toString() ??
          json['last_message']?.toString() ??
          '',
      lastSentAt: rawLastSentAt.isEmpty ? null : DateTime.tryParse(rawLastSentAt),
    );
  }
}


class GroupMember {
  final String userId;
  final String name;
  final String subtitle;
  final String studentNumber;
  final String role;
  final String email;
  final String department;
  final String position;
  final String avatarUrl;
  final bool isAdmin;
  final bool isCurrentUser;
  final bool isDeleted;

  const GroupMember({
    required this.userId,
    required this.name,
    this.subtitle = '',
    this.studentNumber = '',
    this.role = '',
    this.email = '',
    this.department = '',
    this.position = '',
    this.avatarUrl = '',
    this.isAdmin = false,
    this.isCurrentUser = false,
    this.isDeleted = false,
  });

  factory GroupMember.fromJson(Map<String, dynamic> json) {
    String pick(List<String> keys) {
      for (final key in keys) {
        final value = json[key]?.toString().trim() ?? '';
        if (value.isNotEmpty) return value;
      }
      return '';
    }

    bool pickBool(List<String> keys) {
      for (final key in keys) {
        final value = json[key];
        if (value is bool) return value;
        if (value is num) return value != 0;
        if (value is String) return value.toLowerCase() == 'true' || value == '1';
      }
      return false;
    }

    return GroupMember(
      userId: pick(['userId', 'user_id']),
      name: pick(['name']).isNotEmpty ? pick(['name']) : 'Unknown User',
      subtitle: pick(['subtitle']),
      studentNumber: pick(['studentNumber', 'student_number']),
      role: pick(['role']),
      email: pick(['email']),
      department: pick(['department']),
      position: pick(['position']),
      avatarUrl: pick(['avatarUrl', 'avatar_url', 'profile_photo_url']),
      isAdmin: pickBool(['isAdmin', 'is_admin']),
      isCurrentUser: pickBool(['isCurrentUser', 'is_current_user']),
      isDeleted: pickBool(['isDeleted', 'is_deleted']),
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
    } on ApiException catch (error) {
      if (!_shouldFallbackToConversationList(error)) {
        rethrow;
      }

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
    } on ApiException catch (error) {
      if (!_shouldFallbackToConversationList(error)) {
        rethrow;
      }

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
    } on ApiException catch (error) {
      if (!_shouldFallbackToConversationList(error)) {
        rethrow;
      }

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
    } catch (error) {
      debugPrint('MESSAGE UNREAD COUNT ERROR: $error');
      return 0;
    }
  }

  Future<List<ChatRoom>> fetchGroups() async {
    final items = await _getItems('/api/messages/rooms');
    return items
        .map((item) => ChatRoom.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<List<GroupMember>> fetchRoomMembers(String roomId) async {
    final normalizedRoomId = roomId.trim();
    if (normalizedRoomId.isEmpty) return const [];

    // Use the existing room-thread contract. The deployed mobile backend already
    // exposes /thread and /messages, while /members may not exist yet and causes
    // a noisy 404 in Flutter web. The patched backend enriches this same response
    // with membership/profile data.
    Map<String, dynamic> response;
    try {
      response = await _apiClient.getObject(
        '/api/messages/rooms/$normalizedRoomId/thread',
      );
    } on ApiException catch (error) {
      if (error.statusCode != 404 && error.statusCode != 405) {
        rethrow;
      }
      response = await _apiClient.getObject(
        '/api/messages/rooms/$normalizedRoomId/messages',
      );
    }

    final source =
        response['members'] as List<dynamic>? ??
        response['roomMembers'] as List<dynamic>? ??
        response['room_members'] as List<dynamic>? ??
        const [];

    return source
        .whereType<Map>()
        .map((item) => GroupMember.fromJson(Map<String, dynamic>.from(item)))
        .where((item) => item.userId.isNotEmpty)
        .toList(growable: false);
  }

  Future<void> leaveGroup(String roomId) async {
    await _apiClient.postJson(
      '/api/messages/rooms/$roomId/members',
      body: const {'action': 'leave'},
    );
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
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
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

  bool _shouldFallbackToConversationList(ApiException error) {
    return error.statusCode == 404 || error.statusCode == 405;
  }
}
