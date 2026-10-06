// SMaRT-PDM: Messaging — message service (mobile service); calls APIs or shared services and returns processed results.
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

class SupportConversation {
  final String counterpartyId;
  final String title;
  final String personName;
  final String role;
  final String roleLabel;
  final String email;
  final String department;
  final String position;
  final String lastMessage;
  final DateTime? lastSentAt;
  final int unreadCount;
  final bool pinned;
  final String? archiveId;
  final DateTime? archivedAt;

  const SupportConversation({
    required this.counterpartyId,
    required this.title,
    this.personName = '',
    this.role = '',
    this.roleLabel = '',
    this.email = '',
    this.department = '',
    this.position = '',
    this.lastMessage = '',
    this.lastSentAt,
    this.unreadCount = 0,
    this.pinned = false,
    this.archiveId,
    this.archivedAt,
  });

  factory SupportConversation.fromJson(Map<String, dynamic> json) {
    // pick: handles pick for the Messaging flow.
    String pick(List<String> keys) {
      for (final key in keys) {
        final value = json[key]?.toString().trim() ?? '';
        if (value.isNotEmpty) return value;
      }
      return '';
    }

    // pickBool: handles pick bool for the Messaging flow.
    bool pickBool(List<String> keys) {
      for (final key in keys) {
        final value = json[key];
        if (value is bool) return value;
        if (value is num) return value != 0;
        if (value is String) {
          final normalized = value.toLowerCase();
          if (normalized == 'true' || normalized == '1') return true;
        }
      }
      return false;
    }

    // pickDate: handles pick date for the Messaging flow.
    DateTime? pickDate(List<String> keys) {
      final raw = pick(keys);
      return raw.isEmpty ? null : DateTime.tryParse(raw);
    }

    return SupportConversation(
      counterpartyId: pick(['counterpartyId', 'counterparty_id']),
      title: pick(['title', 'name']).isNotEmpty
          ? pick(['title', 'name'])
          : 'Administrative Personnel',
      personName: pick(['personName', 'person_name']),
      role: pick(['role']),
      roleLabel: pick(['roleLabel', 'role_label']),
      email: pick(['email']),
      department: pick(['department']),
      position: pick(['position']),
      lastMessage: pick(['lastMessage', 'last_message']),
      lastSentAt: pickDate(['lastSentAt', 'last_sent_at']),
      unreadCount:
          (json['unreadCount'] as num?)?.toInt() ??
          (json['unread_count'] as num?)?.toInt() ??
          0,
      pinned: pickBool(['pinned', 'isPinned', 'is_pinned']),
      archiveId: pick(['archiveId', 'archive_id']).isEmpty
          ? null
          : pick(['archiveId', 'archive_id']),
      archivedAt: pickDate(['archivedAt', 'archived_at']),
    );
  }
}

class ChatRoom {
  final String roomId;
  final String roomName;
  final int unreadCount;
  final int memberCount;
  final String lastMessage;
  final String lastSenderId;
  final String lastSenderName;
  final String lastMessageSubject;
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
    this.lastSenderId = '',
    this.lastSenderName = '',
    this.lastMessageSubject = '',
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
      lastSenderId:
          json['lastSenderId']?.toString() ??
          json['last_sender_id']?.toString() ??
          '',
      lastSenderName:
          json['lastSenderName']?.toString() ??
          json['last_sender_name']?.toString() ??
          '',
      lastMessageSubject:
          json['lastMessageSubject']?.toString() ??
          json['last_message_subject']?.toString() ??
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
    // pick: handles pick for the Messaging flow.
    String pick(List<String> keys) {
      for (final key in keys) {
        final value = json[key]?.toString().trim() ?? '';
        if (value.isNotEmpty) return value;
      }
      return '';
    }

    // pickBool: handles pick bool for the Messaging flow.
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
  static SupportConversation? _selectedSupportConversation;

  static SupportConversation? get selectedSupportConversation =>
      _selectedSupportConversation;

  static void selectSupportConversation(SupportConversation? conversation) {
    _selectedSupportConversation = conversation;
  }

  final ApiClient _apiClient;

  // fetchThread: fetches and returns fetch thread for the Messaging flow.
  Future<MessageThreadResult> fetchThread() async {
    final selectedCounterpartyId =
        (_selectedSupportConversation?.counterpartyId ?? '').trim();
    final query = Uri(
      queryParameters: <String, String>{
        'limit': '$historyBatchSize',
        if (selectedCounterpartyId.isNotEmpty)
          'counterpartyId': selectedCounterpartyId,
      },
    ).query;

    try {
      final response = await _apiClient.getObject(
        '/api/messages/thread/window?$query',
      );
      _lastConversationCounterpartyId = _readCounterpartyId(response);
      return MessageThreadResult(
        counterpartyId: _lastConversationCounterpartyId,
        items: _parseItems(response['items']),
        hasMore: _readHasMore(response),
      );
    } on ApiException catch (error) {
      if (!_shouldFallbackToConversationList(error)) rethrow;
      return _fetchThreadLegacy(counterpartyId: selectedCounterpartyId);
    }
  }

  // fetchOlderThread: fetches and returns fetch older thread for the Messaging flow.
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

  // _fetchThreadLegacy: handles fetch thread legacy for the Messaging flow.
  Future<MessageThreadResult> _fetchThreadLegacy({String? counterpartyId}) async {
    final selectedCounterpartyId = (counterpartyId ?? '').trim();
    final query = selectedCounterpartyId.isEmpty
        ? ''
        : '?${Uri(queryParameters: <String, String>{
            'counterpartyId': selectedCounterpartyId,
          }).query}';

    final response = await _apiClient.getObject('/api/messages/thread$query');
    _lastConversationCounterpartyId = _readCounterpartyId(response);
    return MessageThreadResult(
      counterpartyId: _lastConversationCounterpartyId,
      items: _parseItems(response['items']),
    );
  }

  // sendThreadMessage: sends send thread message for the Messaging flow.
  Future<ChatMessage> sendThreadMessage(
    String messageBody, {
    String? replyToMessageId,
  }) async {
    final normalizedReplyId = (replyToMessageId ?? '').trim();

    if (normalizedReplyId.isNotEmpty) {
      final response = await _apiClient.postJson(
        '/api/messages/thread/reply',
        body: {
          'messageBody': messageBody,
          'replyToMessageId': normalizedReplyId,
          if (_lastConversationCounterpartyId.isNotEmpty)
            'counterpartyId': _lastConversationCounterpartyId,
        },
      );
      return ChatMessage.fromJson(response);
    }

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

  // markThreadRead: marks mark thread read for the Messaging flow.
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

  // fetchSupportConversations: fetches and returns fetch support conversations for the Messaging flow.
  Future<List<SupportConversation>> fetchSupportConversations() async {
    final response = await _apiClient.getObject(
      '/api/messages/support-conversations',
    );
    final items = response['items'] as List<dynamic>? ?? const [];
    return items
        .whereType<Map>()
        .map(
          (item) => SupportConversation.fromJson(
            Map<String, dynamic>.from(item),
          ),
        )
        .where((item) => item.counterpartyId.isNotEmpty)
        .toList(growable: false);
  }

  // resolveSupportConversation: resolves resolve support conversation for the Messaging flow.
  Future<SupportConversation> resolveSupportConversation(
    String referenceId,
  ) async {
    final normalizedReferenceId = referenceId.trim();
    final query = Uri(
      queryParameters: <String, String>{
        'referenceId': normalizedReferenceId,
      },
    ).query;
    final response = await _apiClient.getObject(
      '/api/messages/support-conversations/resolve?$query',
    );
    final raw = response['conversation'];
    if (raw is! Map) {
      throw const FormatException('Support conversation was not returned.');
    }
    return SupportConversation.fromJson(Map<String, dynamic>.from(raw));
  }

  // fetchArchivedSupportConversations: fetches and returns fetch archived support conversations for the Messaging flow.
  Future<List<SupportConversation>> fetchArchivedSupportConversations() async {
    final response = await _apiClient.getObject(
      '/api/messages/support-conversations/archived',
    );
    final items = response['items'] as List<dynamic>? ?? const [];
    return items
        .whereType<Map>()
        .map(
          (item) => SupportConversation.fromJson(
            Map<String, dynamic>.from(item),
          ),
        )
        .where((item) => item.counterpartyId.isNotEmpty)
        .toList(growable: false);
  }

  // archiveSupportConversation: archives archive support conversation for the Messaging flow.
  Future<void> archiveSupportConversation(String counterpartyId) async {
    final id = counterpartyId.trim();
    if (id.isEmpty) return;
    await _apiClient.patchJson(
      '/api/messages/support-conversations/$id/archive',
    );
  }

  // restoreSupportConversation: restores restore support conversation for the Messaging flow.
  Future<void> restoreSupportConversation(String counterpartyId) async {
    final id = counterpartyId.trim();
    if (id.isEmpty) return;
    await _apiClient.patchJson(
      '/api/messages/support-conversations/$id/restore',
    );
  }

  // fetchUnreadCount: fetches and returns fetch unread count for the Messaging flow.
  Future<int> fetchUnreadCount() async {
    try {
      final response = await _apiClient.getObject('/api/messages/unread-count');
      return (response['unreadCount'] as num?)?.toInt() ?? 0;
    } catch (error) {
      debugPrint('MESSAGE UNREAD COUNT ERROR: $error');
      return 0;
    }
  }

  // fetchGroups: fetches and returns fetch groups for the Messaging flow.
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
              lastSenderId: room.lastSenderId,
              lastSenderName: room.lastSenderName,
              lastMessageSubject: room.lastMessageSubject,
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

  // fetchRoomMembers: fetches and returns fetch room members for the Messaging flow.
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

  // leaveGroup: handles leave group for the Messaging flow.
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

  // fetchRoomThread: fetches and returns fetch room thread for the Messaging flow.
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

  // fetchOlderRoomThread: fetches and returns fetch older room thread for the Messaging flow.
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

  // sendRoomMessage: sends send room message for the Messaging flow.
  Future<ChatMessage> sendRoomMessage(
    String roomId,
    String messageBody, {
    String? replyToMessageId,
  }) async {
    final normalizedReplyId = (replyToMessageId ?? '').trim();

    if (normalizedReplyId.isNotEmpty) {
      final response = await _apiClient.postJson(
        '/api/messages/rooms/$roomId/reply',
        body: {
          'messageBody': messageBody,
          'replyToMessageId': normalizedReplyId,
        },
      );
      return ChatMessage.fromJson(response);
    }

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

  // markRoomThreadRead: marks mark room thread read for the Messaging flow.
  Future<void> markRoomThreadRead(String roomId) async {
    await _apiClient.patchJson('/api/messages/rooms/$roomId/read');
  }

  // unsendMessage: handles unsend message for the Messaging flow.
  Future<ChatMessage> unsendMessage(String messageId) async {
    final response = await _apiClient.patchJson(
      '/api/messages/message/$messageId/unsend',
    );
    return ChatMessage.fromJson(response);
  }

  // fetchArchivedThreads: fetches and returns fetch archived threads for the Messaging flow.
  Future<List<ArchivedMessageThread>> fetchArchivedThreads() async {
    final response = await _apiClient.getObject('/api/messages/archived');
    final items = response['items'] as List<dynamic>? ?? const [];
    return items.whereType<Map>().map((item) => ArchivedMessageThread.fromJson(Map<String, dynamic>.from(item))).where((item) => item.archiveId.isNotEmpty).toList();
  }

  // archivePrivateThread: archives archive private thread for the Messaging flow.
  Future<void> archivePrivateThread() async {
    final selectedId = (_selectedSupportConversation?.counterpartyId ?? '').trim();
    if (selectedId.isNotEmpty) {
      await archiveSupportConversation(selectedId);
      return;
    }
    await _apiClient.patchJson('/api/messages/thread/archive');
  }

  // restorePrivateThread: restores restore private thread for the Messaging flow.
  Future<void> restorePrivateThread() async {
    final selectedId = (_selectedSupportConversation?.counterpartyId ?? '').trim();
    if (selectedId.isNotEmpty) {
      await restoreSupportConversation(selectedId);
      return;
    }
    await _apiClient.patchJson('/api/messages/thread/restore');
  }

  // archiveRoom: archives archive room for the Messaging flow.
  Future<void> archiveRoom(String roomId) async {
    await _apiClient.patchJson('/api/messages/rooms/$roomId/archive');
  }

  // restoreRoom: restores restore room for the Messaging flow.
  Future<void> restoreRoom(String roomId) async {
    await _apiClient.patchJson('/api/messages/rooms/$roomId/restore');
  }

  // _historyQuery: handles history query for the Messaging flow.
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

  // _readHasMore: handles read has more for the Messaging flow.
  bool _readHasMore(Map<String, dynamic> response) {
    final pagination = response['pagination'];
    if (pagination is! Map) return false;
    final raw = pagination['hasMore'] ?? pagination['has_more'];
    if (raw is bool) return raw;
    if (raw is num) return raw != 0;
    return raw?.toString().toLowerCase() == 'true';
  }

  // _readCounterpartyId: handles read counterparty id for the Messaging flow.
  String _readCounterpartyId(Map<String, dynamic> response) {
    return response['counterpartyId']?.toString().trim() ??
        response['counterparty_id']?.toString().trim() ??
        '';
  }

  // _parseItems: handles parse items for the Messaging flow.
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

  // _fetchConversationList: handles fetch conversation list for the Messaging flow.
  Future<List<Map<String, dynamic>>> _fetchConversationList() async {
    final response = await _apiClient.getObject('/api/messages/conversations');
    final items = response['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  // _pickPreferredConversation: handles pick preferred conversation for the Messaging flow.
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

  // _getItems: handles get items for the Messaging flow.
  Future<List<dynamic>> _getItems(String path) async {
    try {
      return await _apiClient.getList(path);
    } catch (_) {
      final response = await _apiClient.getObject(path);
      final items = response['items'] as List<dynamic>?;
      return items ?? const [];
    }
  }

  // _shouldFallbackToConversationList: handles should fallback to conversation list for the Messaging flow.
  bool _shouldFallbackToConversationList(ApiException error) {
    return error.statusCode == 404 || error.statusCode == 405;
  }
}
