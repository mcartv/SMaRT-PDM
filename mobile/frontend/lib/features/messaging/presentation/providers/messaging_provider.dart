import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';

import 'package:smartpdm_mobileapp/core/config/app_config.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_events.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/messaging/data/services/message_service.dart';
import 'package:smartpdm_mobileapp/shared/models/chat_message.dart';

class MessagingProvider extends ChangeNotifier {
  MessagingProvider({
    MessageService? messageService,
    SessionService? sessionService,
    bool enableRealtime = true,
  }) : _messageService = messageService ?? MessageService(),
       _sessionService = sessionService ?? const SessionService(),
       _enableRealtime = enableRealtime;

  final MessageService _messageService;
  final SessionService _sessionService;
  final bool _enableRealtime;

  List<ChatMessage> _messages = [];
  List<ChatRoom> _rooms = [];
  List<ArchivedMessageThread> _archivedThreads = [];
  ChatMessage? _privatePreview;

  int _unreadCount = 0;
  int _privateUnreadCount = 0;
  int _roomMembershipRevision = 0;

  bool _isLoading = false;
  bool _isInitialized = false;
  bool _isViewingThread = false;
  bool _isRealtimeConnected = false;
  bool _isDisposed = false;
  bool _notifyQueued = false;

  String? _errorMessage;
  String _currentUserId = '';
  String _counterpartyId = '';
  String? _activeGroupId;

  VoidCallback? _stopRealtimeListener;
  Timer? _unreadDebounce;
  Timer? _messageReconcileDebounce;
  bool _activeThreadRefreshRunning = false;
  bool _activeThreadRefreshQueued = false;
  bool _activeThreadMarkReadQueued = false;

  static const int _maxRecentRealtimeMessageIds = 200;
  final Set<String> _recentRealtimeMessageIds = <String>{};
  final List<String> _recentRealtimeMessageOrder = <String>[];

  List<ChatMessage> get messages => _messages;
  List<ChatRoom> get rooms => _rooms;
  List<ArchivedMessageThread> get archivedThreads => _archivedThreads;
  bool get isPrivateThreadArchived => _archivedThreads.any((item) => !item.isGroup);
  ChatMessage? get privatePreview => _privatePreview;

  int get unreadCount => _unreadCount;
  int get privateUnreadCount => _privateUnreadCount;
  int get roomMembershipRevision => _roomMembershipRevision;

  bool get isConnected => _isRealtimeConnected;
  bool get isLoading => _isLoading;

  String? get errorMessage => _errorMessage;
  String get currentUserId => _currentUserId;
  String get counterpartyId => _counterpartyId;
  String? get activeGroupId => _activeGroupId;

  int groupUnreadCount(String roomId) {
    final normalizedRoomId = roomId.trim();

    if (normalizedRoomId.isEmpty) {
      return 0;
    }

    for (final room in _rooms) {
      if (room.roomId == normalizedRoomId) {
        return room.unreadCount;
      }
    }

    return 0;
  }

  Future<void> reloadOpenThread({bool markAsRead = false}) async {
    if (!_isViewingThread) {
      return;
    }

    await _queueActiveThreadRefresh(markAsRead: markAsRead);
  }

  Future<void> _queueActiveThreadRefresh({bool markAsRead = false}) async {
    if (_isDisposed || !_isViewingThread) return;

    _activeThreadRefreshQueued = true;
    if (markAsRead) _activeThreadMarkReadQueued = true;

    if (_activeThreadRefreshRunning) return;

    _activeThreadRefreshRunning = true;

    try {
      while (_activeThreadRefreshQueued && !_isDisposed && _isViewingThread) {
        final shouldMarkRead = _activeThreadMarkReadQueued;
        _activeThreadRefreshQueued = false;
        _activeThreadMarkReadQueued = false;

        await _refreshThread(notify: false);
        final hasUnreadIncoming = _messages.any(
          (message) =>
              message.senderId != _currentUserId && message.isRead == false,
        );
        if (shouldMarkRead && _isViewingThread && hasUnreadIncoming) {
          await markThreadRead();
        }
        _notify();
      }
    } finally {
      _activeThreadRefreshRunning = false;
    }
  }

  Future<void> initializeChat() async {
    final session = await _sessionService.getCurrentUser();

    if (session.token.isEmpty || session.userId.isEmpty) {
      debugPrint('[MessagingProvider] initialize skipped: empty session');
      return;
    }

    final sameUser = _isInitialized && _currentUserId == session.userId;

    _currentUserId = session.userId;
    _isInitialized = true;

    if (_enableRealtime) {
      // Register before connecting so the provider cannot miss a fast
      // socket:connected event. Use the same SessionService token/user id as
      // REST requests instead of re-reading potentially stale preference keys.
      _ensureRealtimeListener();
      await MobileRealtimeService.instance.connect(
        backendBaseUrl: AppConfig.apiBaseUrl,
        token: session.token,
        userId: session.userId,
      );

      _isRealtimeConnected = MobileRealtimeService.instance.isRealtimeHealthy;
    } else {
      _isRealtimeConnected = false;
    }

    if (!sameUser) {
      _messages = [];
      _rooms = [];
      _archivedThreads = [];
      _privatePreview = null;
      _counterpartyId = '';
      _activeGroupId = null;
      _unreadCount = 0;
      _privateUnreadCount = 0;
      _roomMembershipRevision = 0;
      _recentRealtimeMessageIds.clear();
      _recentRealtimeMessageOrder.clear();

      await _refreshThread(notify: false);
      await fetchArchivedThreads(notify: false);
      _roomMembershipRevision += 1;
      await fetchArchivedThreads(notify: false);
      await fetchGroups(notify: false);
      await refreshUnreadCount(notify: false);
    }

    _notify();
  }

  Future<void> enterThread() async {
    // Initialize first because the first initialization resets the current
    // conversation state for a newly authenticated user.
    await initializeChat();

    if (_isDisposed) {
      return;
    }

    _isViewingThread = true;
    _activeGroupId = null;

    await _refreshThread();
    await markThreadRead();
  }

  Future<void> enterRoom(String roomId) async {
    final normalizedRoomId = roomId.trim();

    if (normalizedRoomId.isEmpty) {
      return;
    }

    // Initialize first. initializeChat() resets _activeGroupId when the provider
    // is initialized for a new user, so the room must be selected afterward.
    await initializeChat();

    if (_isDisposed) {
      return;
    }

    _isViewingThread = true;
    _activeGroupId = normalizedRoomId;

    await _refreshThread();
    await markThreadRead();
  }

  void leaveThread({bool notify = true}) {
    _isViewingThread = false;
    _activeGroupId = null;
    _messages = [];
    _activeThreadRefreshQueued = false;
    _activeThreadMarkReadQueued = false;

    if (notify) {
      _notify();
    }
  }

  Future<void> refresh() async {
    await initializeChat();
    await _refreshThread();
    await fetchArchivedThreads(notify: false);
    await fetchGroups(notify: false);
    await refreshUnreadCount();
  }

  Future<void> fetchArchivedThreads({bool notify = true}) async {
    try {
      _archivedThreads = await _messageService.fetchArchivedThreads();
      _errorMessage = null;
      if (notify) _notify();
    } catch (error) {
      _errorMessage = _readableError(error);
      debugPrint('[MessagingProvider] fetch archived threads error: $error');
      if (notify) _notify();
    }
  }

  Future<void> archivePrivateThread() async {
    await _messageService.archivePrivateThread();
    await fetchArchivedThreads(notify: false);
    await refreshUnreadCount(notify: false);
    _notify();
  }

  Future<void> archiveRoom(String roomId) async {
    await _messageService.archiveRoom(roomId);
    if (_activeGroupId == roomId) {
      _isViewingThread = false;
      _activeGroupId = null;
      _messages = [];
    }
    await fetchArchivedThreads(notify: false);
    await fetchGroups(notify: false);
    await refreshUnreadCount(notify: false);
    _notify();
  }

  Future<void> restoreArchivedThread(ArchivedMessageThread thread) async {
    if (thread.isGroup) {
      final roomId = (thread.roomId ?? '').trim();
      if (roomId.isEmpty) return;
      await _messageService.restoreRoom(roomId);
    } else {
      await _messageService.restorePrivateThread();
    }
    await fetchArchivedThreads(notify: false);
    await fetchGroups(notify: false);
    await refreshUnreadCount(notify: false);
    _notify();
  }

  Future<List<GroupMember>> fetchRoomMembers(String roomId) async {
    final normalizedRoomId = roomId.trim();

    if (normalizedRoomId.isEmpty) {
      return const <GroupMember>[];
    }

    try {
      final members = await _messageService.fetchRoomMembers(normalizedRoomId);
      _errorMessage = null;
      return members;
    } catch (error) {
      _errorMessage = _readableError(error);
      debugPrint('[MessagingProvider] fetch room members error: $error');
      _notify();
      rethrow;
    }
  }

  Future<void> leaveGroup(String roomId) async {
    final normalizedRoomId = roomId.trim();

    if (normalizedRoomId.isEmpty) {
      return;
    }

    try {
      await _messageService.leaveGroup(normalizedRoomId);

      if (_activeGroupId == normalizedRoomId) {
        _isViewingThread = false;
        _activeGroupId = null;
        _messages = [];
      }

      await fetchGroups(notify: false);
      await refreshUnreadCount(notify: false);
      _errorMessage = null;
      _notify();
    } catch (error) {
      _errorMessage = _readableError(error);
      debugPrint('[MessagingProvider] leave group error: $error');
      _notify();
      rethrow;
    }
  }

  Future<void> fetchGroups({bool notify = true}) async {
    if (notify) {
      _isLoading = true;
      _notify();
    }

    try {
      _rooms = List<ChatRoom>.of(await _messageService.fetchGroups());
      _syncTotalUnreadCount();
      _errorMessage = null;
    } catch (error) {
      _errorMessage = _readableError(error);
      debugPrint('[MessagingProvider] fetch groups error: $error');
    } finally {
      if (notify) {
        _isLoading = false;
        _notify();
      }
    }
  }

  Future<void> refreshUnreadCount({bool notify = true}) async {
    try {
      final totalUnread = await _messageService.fetchUnreadCount();

      final groupUnread = _rooms.fold<int>(
        0,
        (sum, room) => sum + room.unreadCount,
      );

      _privateUnreadCount = totalUnread - groupUnread;

      if (_privateUnreadCount < 0) {
        _privateUnreadCount = 0;
      }

      _syncTotalUnreadCount();

      if (notify) {
        _notify();
      }
    } catch (error) {
      debugPrint('[MessagingProvider] unread count error: $error');
    }
  }

  Future<void> sendMessage(String text) async {
    final trimmed = text.trim();

    if (trimmed.isEmpty) {
      return;
    }

    try {
      ChatMessage message;

      if (_activeGroupId != null) {
        message = await _messageService.sendRoomMessage(
          _activeGroupId!,
          trimmed,
        );
      } else {
        message = await _messageService.sendThreadMessage(trimmed);
      }

      _errorMessage = null;
      _upsertMessage(message);
      if (_activeGroupId != null) {
        _updateGroupPreview(_activeGroupId!, message);
      } else {
        _privatePreview = message;
      }
      _notify();
    } catch (error) {
      _errorMessage = _readableError(error);
      _notify();
      rethrow;
    }
  }

  Future<void> markThreadRead() async {
    try {
      if (_activeGroupId != null) {
        await _messageService.markRoomThreadRead(_activeGroupId!);

        _markMessagesRead(
          _messages.map((message) => message.messageId).toList(),
        );

        _setGroupUnreadCount(_activeGroupId!, 0);

        await refreshUnreadCount(notify: false);
        _notify();
        return;
      }

      final result = await _messageService.markThreadRead(
        counterpartyId: _counterpartyId,
      );

      if (result.messageIds.isNotEmpty) {
        _markMessagesRead(result.messageIds);
        _recalculatePrivateUnreadCount();
        _notify();
      } else {
        await refreshUnreadCount();
      }
    } catch (error) {
      debugPrint('[MessagingProvider] mark read error: $error');
    }
  }

  Future<void> _refreshThread({bool notify = true}) async {
    _isLoading = true;
    _errorMessage = null;

    if (notify) {
      _notify();
    }

    try {
      if (_activeGroupId != null) {
        _messages = List<ChatMessage>.of(
          await _messageService.fetchRoomThread(_activeGroupId!),
        );
        _setGroupUnreadCount(_activeGroupId!, 0);
        await refreshUnreadCount(notify: false);
      } else {
        final result = await _messageService.fetchThread();
        _counterpartyId = result.counterpartyId;
        _messages = result.items.toList();
        _recalculatePrivateUnreadCount();
      }

      _sortMessagesNewestFirst();
      if (_activeGroupId == null && _messages.isNotEmpty) {
        _privatePreview = _messages.first;
      }
      _errorMessage = null;
    } catch (error) {
      _errorMessage = _readableError(error);
      debugPrint('[MessagingProvider] refresh thread error: $error');
    } finally {
      _isLoading = false;

      if (notify) {
        _notify();
      }
    }
  }

  void _ensureRealtimeListener() {
    _stopRealtimeListener ??= MobileRealtimeService.instance.listenTo(<String>{
      ...MobileRealtimeEvents.messageEvents,
      'socket:connected',
      'socket:reconnected',
      'socket:disconnected',
      'socket:error',
      MobileRealtimeEvents.bridgeStatus,
    }, _handleRealtimeEvent);
  }

  Future<void> _handleRealtimeEvent(MobileRealtimeEvent event) async {
    debugPrint('[MessagingProvider] realtime event: ${event.name}');

    switch (event.name) {
      case 'socket:connected':
      case 'socket:reconnected':
        _isRealtimeConnected =
            MobileRealtimeService.instance.isRealtimeHealthy;
        _errorMessage = null;

        // Reconcile authoritative state after a fresh/recovered socket. This
        // also catches any message written while Render or the device was
        // temporarily disconnected without replacing realtime delivery.
        await fetchArchivedThreads(notify: false);
        await fetchGroups(notify: false);
        await refreshUnreadCount(notify: false);
        if (_isViewingThread) {
          await _refreshThread(notify: false);
          await markThreadRead();
        }
        _notify();
        return;

      case MobileRealtimeEvents.bridgeStatus:
        final wasHealthy = _isRealtimeConnected;
        _isRealtimeConnected =
            MobileRealtimeService.instance.isRealtimeHealthy;

        if (_isRealtimeConnected && !wasHealthy) {
          await fetchArchivedThreads(notify: false);
          await fetchGroups(notify: false);
          await refreshUnreadCount(notify: false);
          if (_isViewingThread) {
            await _queueActiveThreadRefresh(markAsRead: true);
          }
          _errorMessage = null;
        }

        _notify();
        return;

      case 'socket:disconnected':
      case 'socket:error':
        _isRealtimeConnected = false;
        _notify();
        return;

      case MobileRealtimeEvents.messageNew:
      case MobileRealtimeEvents.messageCreated:
      case MobileRealtimeEvents.messageUpdated:
        _handleMessageRealtimeFast(event);
        _scheduleRealtimeMessageReconcile();
        return;

      case MobileRealtimeEvents.messageRead:
        _handleMessageReadRealtime(event);
        return;

      case MobileRealtimeEvents.messageUnread:
        _handleMessageUnreadRealtime(event);
        return;

      case MobileRealtimeEvents.messageThreadArchived:
      case MobileRealtimeEvents.messageThreadRestored:
        await fetchArchivedThreads(notify: false);
        await fetchGroups(notify: false);
        await refreshUnreadCount(notify: false);
        _notify();
        return;

      case MobileRealtimeEvents.conversationUpdated:
      case MobileRealtimeEvents.roomCreated:
      case MobileRealtimeEvents.roomMembersAdded:
      case MobileRealtimeEvents.roomMembersRemoved:
      case MobileRealtimeEvents.roomMemberLeft:
      case MobileRealtimeEvents.roomMemberPromoted:
      case MobileRealtimeEvents.roomUpdated:
      case MobileRealtimeEvents.roomArchived:
      case MobileRealtimeEvents.roomRestored:
        _roomMembershipRevision += 1;
        await fetchArchivedThreads(notify: false);
        await fetchGroups(notify: false);
        await refreshUnreadCount(notify: false);
        final activeRoomId = _activeGroupId;
        if (activeRoomId != null && !_rooms.any((room) => room.roomId == activeRoomId)) {
          _isViewingThread = false;
          _activeGroupId = null;
          _messages = [];
        }
        _notify();
        return;

      default:
        return;
    }
  }

  void _handleMessageRealtimeFast(MobileRealtimeEvent event) {
    final payload = event.payload;

    if (payload.isEmpty) {
      debugPrint('[MessagingProvider] realtime message ignored: empty payload');
      return;
    }

    ChatMessage message;

    try {
      message = ChatMessage.fromJson(payload);
    } catch (error) {
      debugPrint('[MessagingProvider] message parse error: $error');
      return;
    }

    if ((event.name == MobileRealtimeEvents.messageNew ||
            event.name == MobileRealtimeEvents.messageCreated) &&
        !_rememberRealtimeMessage(message.messageId)) {
      return;
    }

    final roomId = (message.roomId ?? '').trim();
    final isGroupMessage = roomId.isNotEmpty;
    final senderId = message.senderId.trim();
    final receiverId = (message.receiverId ?? '').trim();

    final isPrivateForCurrentUser =
        !isGroupMessage &&
        _currentUserId.trim().isNotEmpty &&
        (senderId == _currentUserId || receiverId == _currentUserId);

    final isViewingPrivateThread = _isViewingThread && _activeGroupId == null;

    final isActiveGroupMessage =
        _isViewingThread &&
        isGroupMessage &&
        _activeGroupId != null &&
        _activeGroupId == roomId;

    debugPrint(
      '[MessagingProvider] realtime message check: '
      'messageId=${message.messageId}, '
      'senderId=$senderId, '
      'receiverId=$receiverId, '
      'currentUserId=$_currentUserId, '
      'roomId=$roomId, '
      'activeGroupId=$_activeGroupId, '
      'isViewingThread=$_isViewingThread, '
      'isPrivateForCurrentUser=$isPrivateForCurrentUser, '
      'isViewingPrivateThread=$isViewingPrivateThread, '
      'isActiveGroupMessage=$isActiveGroupMessage',
    );

    if (isPrivateForCurrentUser) {
      _privatePreview = message;

      // Only place a private message in the visible message list while the
      // private OSFA conversation is open. This prevents private messages from
      // appearing inside an active scholarship group chat.
      if (isViewingPrivateThread) {
        _upsertMessage(message);
        _recalculatePrivateUnreadCount();
        _notify();
        unawaited(markThreadRead());
      } else {
        _scheduleUnreadRefresh();
      }
      return;
    }

    if (isActiveGroupMessage) {
      _upsertMessage(message);
      _updateGroupPreview(roomId, message);
      _setGroupUnreadCount(roomId, 0);
      _notify();
      unawaited(markThreadRead());
      return;
    }

    if (isGroupMessage) {
      _updateGroupPreview(roomId, message);
      if (_incrementGroupUnreadCount(roomId)) {
        _notify();
      } else {
        fetchGroups();
      }

      _scheduleUnreadRefresh();
      return;
    }

    _scheduleUnreadRefresh();
  }

  bool _rememberRealtimeMessage(String messageId) {
    final normalizedMessageId = messageId.trim();
    if (normalizedMessageId.isEmpty) return true;
    if (_recentRealtimeMessageIds.contains(normalizedMessageId)) return false;
    _recentRealtimeMessageIds.add(normalizedMessageId);
    _recentRealtimeMessageOrder.add(normalizedMessageId);
    while (_recentRealtimeMessageOrder.length > _maxRecentRealtimeMessageIds) {
      final oldest = _recentRealtimeMessageOrder.removeAt(0);
      _recentRealtimeMessageIds.remove(oldest);
    }
    return true;
  }

  void _handleMessageReadRealtime(MobileRealtimeEvent event) {
    final messageIds = _extractMessageIds(event.payload);

    if (messageIds.isEmpty) {
      return;
    }

    _markMessagesRead(messageIds);
    _recalculatePrivateUnreadCount();
    _notify();
  }

  void _handleMessageUnreadRealtime(MobileRealtimeEvent event) {
    final messageIds = _extractMessageIds(event.payload);

    if (messageIds.isEmpty) {
      return;
    }

    final ids = messageIds.toSet();

    _messages = _messages.map((message) {
      if (!ids.contains(message.messageId)) {
        return message;
      }

      return message.copyWith(isRead: false);
    }).toList();

    _recalculatePrivateUnreadCount();
    _notify();
  }

  void _scheduleUnreadRefresh() {
    _unreadDebounce?.cancel();

    _unreadDebounce = Timer(const Duration(milliseconds: 250), () {
      refreshUnreadCount();
    });
  }

  void _scheduleRealtimeMessageReconcile() {
    _messageReconcileDebounce?.cancel();

    _messageReconcileDebounce = Timer(
      const Duration(milliseconds: 180),
      () async {
        if (_isDisposed || !_isInitialized) return;

        try {
          // Socket payloads are used for immediate display, then the API is
          // reconciled a fraction of a second later. This prevents a payload
          // shape mismatch, duplicate relay, or missed room metadata update
          // from leaving the mobile UI stale while keeping Socket.IO as the
          // realtime trigger instead of polling.
          await fetchArchivedThreads(notify: false);
          await fetchGroups(notify: false);

          if (_isViewingThread) {
            await _queueActiveThreadRefresh(markAsRead: true);
          } else {
            try {
              final result = await _messageService.fetchThread();
              _counterpartyId = result.counterpartyId;
              if (result.items.isNotEmpty) {
                _privatePreview = result.items.first;
              }
            } catch (error) {
              debugPrint(
                '[MessagingProvider] private preview reconcile error: $error',
              );
            }
          }

          await refreshUnreadCount(notify: false);
          _errorMessage = null;
          _notify();
        } catch (error) {
          debugPrint(
            '[MessagingProvider] realtime authoritative reconcile error: $error',
          );
        }
      },
    );
  }

  void _upsertMessage(ChatMessage message) {
    if (message.messageId.trim().isEmpty) {
      debugPrint('[MessagingProvider] upsert skipped: empty messageId');
      return;
    }

    final beforeCount = _messages.length;

    final existingIndex = _messages.indexWhere(
      (item) => item.messageId == message.messageId,
    );

    if (existingIndex >= 0) {
      _messages[existingIndex] = message;
    } else {
      _messages.insert(0, message);
    }

    _sortMessagesNewestFirst();

    debugPrint(
      '[MessagingProvider] upsert done: '
      'before=$beforeCount, '
      'after=${_messages.length}, '
      'messageId=${message.messageId}, '
      'body=${message.messageBody}',
    );
  }

  void _sortMessagesNewestFirst() {
    _messages.sort((left, right) => right.sentAt.compareTo(left.sentAt));
  }

  void _markMessagesRead(List<String> messageIds) {
    final ids = messageIds.toSet();

    _messages = _messages.map((message) {
      if (!ids.contains(message.messageId)) {
        return message;
      }

      return message.copyWith(isRead: true);
    }).toList();
  }

  void _recalculatePrivateUnreadCount() {
    _privateUnreadCount = _messages
        .where(
          (message) => message.receiverId == _currentUserId && !message.isRead,
        )
        .length;

    _syncTotalUnreadCount();
  }

  bool _incrementGroupUnreadCount(String roomId) {
    final normalizedRoomId = roomId.trim();

    if (normalizedRoomId.isEmpty) {
      return false;
    }

    final index = _rooms.indexWhere((room) => room.roomId == normalizedRoomId);

    if (index < 0) {
      return false;
    }

    final room = _rooms[index];

    _rooms[index] = ChatRoom(
      roomId: room.roomId,
      roomName: room.roomName,
      unreadCount: room.unreadCount + 1,
      memberCount: room.memberCount,
      lastMessage: room.lastMessage,
      lastSentAt: room.lastSentAt,
    );

    _syncTotalUnreadCount();
    return true;
  }

  void _setGroupUnreadCount(String roomId, int count) {
    final normalizedRoomId = roomId.trim();

    if (normalizedRoomId.isEmpty) {
      return;
    }

    final index = _rooms.indexWhere((room) => room.roomId == normalizedRoomId);

    if (index < 0) {
      return;
    }

    final room = _rooms[index];

    _rooms[index] = ChatRoom(
      roomId: room.roomId,
      roomName: room.roomName,
      unreadCount: count < 0 ? 0 : count,
      memberCount: room.memberCount,
      lastMessage: room.lastMessage,
      lastSentAt: room.lastSentAt,
    );

    _syncTotalUnreadCount();
  }

  void _updateGroupPreview(String roomId, ChatMessage message) {
    final normalizedRoomId = roomId.trim();
    if (normalizedRoomId.isEmpty) return;

    final index = _rooms.indexWhere((room) => room.roomId == normalizedRoomId);
    if (index < 0) return;

    final room = _rooms[index];
    _rooms[index] = ChatRoom(
      roomId: room.roomId,
      roomName: room.roomName,
      unreadCount: room.unreadCount,
      memberCount: room.memberCount,
      lastMessage: message.messageBody,
      lastSentAt: message.sentAt,
    );

    _rooms.sort((left, right) {
      final leftTime = left.lastSentAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final rightTime = right.lastSentAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      return rightTime.compareTo(leftTime);
    });
  }

  void _syncTotalUnreadCount() {
    final groupUnread = _rooms.fold<int>(
      0,
      (sum, room) => sum + room.unreadCount,
    );

    _unreadCount = _privateUnreadCount + groupUnread;
  }

  List<String> _extractMessageIds(Map<String, dynamic> payload) {
    final rawItems =
        (payload['messageIds'] as List<dynamic>?) ??
        (payload['message_ids'] as List<dynamic>?) ??
        const [];

    return rawItems
        .map((item) => item.toString())
        .where((item) => item.isNotEmpty)
        .toList();
  }

  String _readableError(Object error) {
    final text = error
        .toString()
        .replaceFirst(RegExp(r'^Exception:\s*'), '')
        .trim();
    final lower = text.toLowerCase();

    if (lower.contains('timeout')) {
      return 'The messaging server took too long to respond. Try again.';
    }

    if (lower.contains('socket') ||
        lower.contains('connection') ||
        lower.contains('network') ||
        lower.contains('failed host lookup')) {
      return 'Messaging is temporarily offline. Check your connection and retry.';
    }

    if (lower.contains('401') || lower.contains('unauthorized')) {
      return 'Your session expired. Sign in again to continue messaging.';
    }

    return text.isEmpty ? 'Unable to load messages.' : text;
  }

  void _notify() {
    if (_isDisposed) {
      return;
    }

    final phase = SchedulerBinding.instance.schedulerPhase;

    if (phase == SchedulerPhase.idle) {
      notifyListeners();
      return;
    }

    if (_notifyQueued) {
      return;
    }

    _notifyQueued = true;

    SchedulerBinding.instance.addPostFrameCallback((_) {
      _notifyQueued = false;

      if (!_isDisposed) {
        notifyListeners();
      }
    });
  }

  @override
  void dispose() {
    _isDisposed = true;

    _unreadDebounce?.cancel();
    _unreadDebounce = null;
    _messageReconcileDebounce?.cancel();
    _messageReconcileDebounce = null;

    _stopRealtimeListener?.call();
    _stopRealtimeListener = null;

    super.dispose();
  }
}
