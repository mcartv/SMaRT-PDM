import 'package:smartpdm_mobileapp/shared/models/chat_message.dart';
import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:flutter/foundation.dart';

class MessageThreadResult {
  final String counterpartyId;
  final List<ChatMessage> items;
  final bool hasMore;

  const MessageThreadResult({
    required this.counterpartyId,
    required this.items,
    this.hasMore = false,
  });
}

class MessageHistoryPage {
  final List<ChatMessage> items;
  final bool hasMore;

  const MessageHistoryPage({required this.items, this.hasMore = false});
}

class MessageReadResult {
  final int updatedCount;
  final List<String> messageIds;

  const MessageReadResult({
    required this.updatedCount,
    required this.messageIds,
  });
}

class ArchivedMessageThread {
  final String archiveId;
  final String threadType;
  final String? counterpartyId;
  final String? roomId;
  final String name;
  final DateTime? archivedAt;
  final bool canRestore;
  final bool readOnly;
  final bool formerMember;

  const ArchivedMessageThread({
    required this.archiveId,
    required this.threadType,
    required this.name,
    this.counterpartyId,
    this.roomId,
    this.archivedAt,
    this.canRestore = true,
    this.readOnly = false,
    this.formerMember = false,
  });

  bool get isGroup => threadType == 'group';

  factory ArchivedMessageThread.fromJson(Map<String, dynamic> json) {
    final archivedAtRaw =
        json['archivedAt']?.toString() ?? json['archived_at']?.toString();

    return ArchivedMessageThread(
      archiveId:
          json['archiveId']?.toString() ?? json['archive_id']?.toString() ?? '',
      threadType:
          json['threadType']?.toString() ??
          json['thread_type']?.toString() ??
          'private',
      counterpartyId:
          json['counterpartyId']?.toString() ??
          json['counterparty_id']?.toString(),
      roomId: json['roomId']?.toString() ?? json['room_id']?.toString(),
      name: json['name']?.toString() ?? 'Conversation',
      archivedAt: archivedAtRaw == null ? null : DateTime.tryParse(archivedAtRaw),
      canRestore: json['canRestore'] == true || json['can_restore'] == true || json['canRestore'] == null && json['can_restore'] == null,
      readOnly: json['readOnly'] == true || json['read_only'] == true,
      formerMember: json['formerMember'] == true || json['former_member'] == true,
    );
  }
}

class ChatRoom {
  final String roomId;
  final String roomName;
  final int unreadCount;
  final int memberCount;
  final String lastMessage;
  final DateTime? lastSentAt;
  final bool readOnly;
  final bool formerMember;
  final DateTime? cutoffAt;

  const ChatRoom({
    required this.roomId,
    required this.roomName,
    this.unreadCount = 0,
    this.memberCount = 0,
    this.lastMessage = '',
    this.lastSentAt,
    this.readOnly = false,
    this.formerMember = false,
    this.cutoffAt,
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
      readOnly: json['readOnly'] == true || json['read_only'] == true,
      formerMember: json['formerMember'] == true || json['former_member'] == true,
      cutoffAt: DateTime.tryParse(json['cutoffAt']?.toString() ?? json['cutoff_at']?.toString() ?? json['archivedAt']?.toString() ?? json['archived_at']?.toString() ?? ''),
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

  static const int historyBatchSize = 30;
  final ApiClient _apiClient;

  Future<MessageThreadResult> fetchThread() async {
    try {
      final response = await _apiClient.getObject(
        '/api/messages/thread/window?limit=$historyBatchSize',
      );
      _lastConversationCounterpartyId = _readCounterpartyId(response);
      return MessageThreadResult(
        counterpartyId: _lastConversationCounterpartyId,
        items: _parseItems(response['items']),
        hasMore: _readHasMore(response),
      );
    } on ApiException catch (error) {
      if (!_shouldFallbackToConversationList(error)) rethrow;
      return _fetchThreadLegacy();
    }
  }

  Future<MessageThreadResult> fetchOlderThread({
    required ChatMessage before,
    String? counterpartyId,
  }) async {
    final query = _historyQuery(
      before: before,
      counterpartyId: counterpartyId,
    );
    final response = await _apiClient.getObject('/api/messages/thread/window?$query');
    final resolvedCounterpartyId = _readCounterpartyId(response);
    if (resolvedCounterpartyId.isNotEmpty) {
      _lastConversationCounterpartyId = resolvedCounterpartyId;
    }
    return MessageThreadResult(
      counterpartyId: _lastConversationCounterpartyId,
      items: _parseItems(response['items']),
      hasMore: _readHasMore(response),
    );
  }

  Future<MessageThreadResult> _fetchThreadLegacy() async {
    try {
      final response = await _apiClient.getObject('/api/messages/thread');
      _lastConversationCounterpartyId = _readCounterpartyId(response);
      return MessageThreadResult(
        counterpartyId: _lastConversationCounterpartyId,
        items: _parseItems(response['items']),
      );
    } on ApiException catch (error) {
      if (!_shouldFallbackToConversationList(error)) rethrow;

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
        body: {
          'messageBody': messageBody,
          if (_lastConversationCounterpartyId.isNotEmpty)
            'counterpartyId': _lastConversationCounterpartyId,
        },
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
      final targetCounterpartyId = (counterpartyId ?? '').trim().isNotEmpty
          ? counterpartyId!.trim()
          : _lastConversationCounterpartyId;
      final response = await _apiClient.patchJson(
        '/api/messages/thread/read',
        body: {
          if (targetCounterpartyId.isNotEmpty)
            'counterpartyId': targetCounterpartyId,
        },
      );
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
    final activeItems = await _getItems('/api/messages/rooms');
    final rooms = activeItems
        .map((item) => ChatRoom.fromJson(Map<String, dynamic>.from(item)))
        .toList();

    try {
      final formerItems = await _getItems('/api/messages/former-rooms');
      final activeIds = rooms.map((room) => room.roomId).toSet();
      for (final item in formerItems) {
        final room = ChatRoom.fromJson(Map<String, dynamic>.from(item));
        if (room.roomId.isNotEmpty && !activeIds.contains(room.roomId)) {
          rooms.add(
            ChatRoom(
              roomId: room.roomId,
              roomName: room.roomName,
              unreadCount: 0,
              memberCount: room.memberCount,
              lastMessage: room.lastMessage.isEmpty
                  ? 'Read-only history — you are no longer a member'
                  : 'Read-only · ${room.lastMessage}',
              lastSentAt: room.lastSentAt,
              readOnly: true,
              formerMember: true,
              cutoffAt: room.cutoffAt,
            ),
          );
        }
      }
    } on ApiException catch (error) {
      if (error.statusCode != 404 && error.statusCode != 405) rethrow;
    }

    rooms.sort((left, right) {
      final leftTime = left.lastSentAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final rightTime = right.lastSentAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      return rightTime.compareTo(leftTime);
    });
    return rooms;
  }

  Future<List<GroupMember>> fetchRoomMembers(String roomId) async {
    final normalizedRoomId = roomId.trim();
    if (normalizedRoomId.isEmpty) return const [];

    Map<String, dynamic> response;
    try {
      response = await _apiClient.getObject(
        '/api/messages/rooms/$normalizedRoomId/members',
      );
    } on ApiException catch (error) {
      if (error.statusCode != 404 && error.statusCode != 405) rethrow;
      try {
        response = await _apiClient.getObject(
          '/api/messages/rooms/$normalizedRoomId/thread',
        );
      } on ApiException catch (fallbackError) {
        if (fallbackError.statusCode != 404 && fallbackError.statusCode != 405) rethrow;
        response = await _apiClient.getObject(
          '/api/messages/rooms/$normalizedRoomId/messages',
        );
      }
    }

    final source =
        response['items'] as List<dynamic>? ??
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
    final normalizedRoomId = roomId.trim();
    if (normalizedRoomId.isEmpty) return;
    try {
      await _apiClient.deleteJson('/api/messages/rooms/$normalizedRoomId/leave');
    } on ApiException catch (error) {
      if (error.statusCode != 404 && error.statusCode != 405) rethrow;
      await _apiClient.postJson(
        '/api/messages/rooms/$normalizedRoomId/members',
        body: const {'action': 'leave'},
      );
    }
  }

  Future<List<ChatMessage>> fetchRoomThread(String roomId) async {
    final normalizedRoomId = roomId.trim();
    try {
      final response = await _apiClient.getObject(
        '/api/messages/rooms/$normalizedRoomId/window?limit=$historyBatchSize',
      );
      return _parseItems(response['items']);
    } on ApiException catch (error) {
      if (error.statusCode != 404 && error.statusCode != 405 && error.statusCode != 403) rethrow;
    }

    try {
      final response = await _apiClient.getObject(
        '/api/messages/rooms/$normalizedRoomId/thread',
      );
      return _parseItems(response['items']);
    } on ApiException catch (error) {
      if (error.statusCode != 403 && error.statusCode != 404 && error.statusCode != 405) rethrow;
    }

    final former = await _apiClient.getObject(
      '/api/messages/former-rooms/$normalizedRoomId/window?limit=$historyBatchSize',
    );
    return _parseItems(former['items']);
  }

  Future<MessageHistoryPage> fetchOlderRoomThread(
    String roomId, {
    required ChatMessage before,
  }) async {
    final normalizedRoomId = roomId.trim();
    final query = _historyQuery(before: before);
    try {
      final response = await _apiClient.getObject(
        '/api/messages/rooms/$normalizedRoomId/window?$query',
      );
      return MessageHistoryPage(
        items: _parseItems(response['items']),
        hasMore: _readHasMore(response),
      );
    } on ApiException catch (error) {
      if (error.statusCode != 403 && error.statusCode != 404 && error.statusCode != 405) rethrow;
    }

    final response = await _apiClient.getObject(
      '/api/messages/former-rooms/$normalizedRoomId/window?$query',
    );
    return MessageHistoryPage(
      items: _parseItems(response['items']),
      hasMore: _readHasMore(response),
    );
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

  Future<ChatMessage> unsendMessage(String messageId) async {
    final response = await _apiClient.patchJson(
      '/api/messages/message/$messageId/unsend',
    );
    return ChatMessage.fromJson(response);
  }

  Future<List<ArchivedMessageThread>> fetchArchivedThreads() async {
    final response = await _apiClient.getObject('/api/messages/archived');
    final items = response['items'] as List<dynamic>? ?? const [];
    return items.whereType<Map>().map((item) => ArchivedMessageThread.fromJson(Map<String, dynamic>.from(item))).where((item) => item.archiveId.isNotEmpty).toList();
  }

  Future<void> archivePrivateThread() async {
    await _apiClient.patchJson('/api/messages/thread/archive');
  }

  Future<void> restorePrivateThread() async {
    await _apiClient.patchJson('/api/messages/thread/restore');
  }

  Future<void> archiveRoom(String roomId) async {
    await _apiClient.patchJson('/api/messages/rooms/$roomId/archive');
  }

  Future<void> restoreRoom(String roomId) async {
    await _apiClient.patchJson('/api/messages/rooms/$roomId/restore');
  }

  String _historyQuery({
    required ChatMessage before,
    String? counterpartyId,
  }) {
    final values = <String, String>{
      'limit': '$historyBatchSize',
      'beforeSentAt': before.sentAt.toUtc().toIso8601String(),
      'beforeMessageId': before.messageId,
      if ((counterpartyId ?? '').trim().isNotEmpty)
        'counterpartyId': counterpartyId!.trim(),
    };
    return Uri(queryParameters: values).query;
  }

  bool _readHasMore(Map<String, dynamic> response) {
    final pagination = response['pagination'];
    if (pagination is! Map) return false;
    final raw = pagination['hasMore'] ?? pagination['has_more'];
    if (raw is bool) return raw;
    if (raw is num) return raw != 0;
    return raw?.toString().toLowerCase() == 'true';
  }

  String _readCounterpartyId(Map<String, dynamic> response) {
    return response['counterpartyId']?.toString().trim() ??
        response['counterparty_id']?.toString().trim() ??
        '';
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
