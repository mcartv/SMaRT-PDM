import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:smartpdm_mobileapp/core/config/app_config.dart';
import 'package:smartpdm_mobileapp/shared/models/chat_message.dart';
import 'package:smartpdm_mobileapp/features/messaging/data/services/message_service.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';

class MessagingProvider extends ChangeNotifier {
  MessagingProvider({
    MessageService? messageService,
    SessionService? sessionService,
  }) : _messageService = messageService ?? MessageService(),
       _sessionService = sessionService ?? const SessionService();

  final MessageService _messageService;
  final SessionService _sessionService;

  List<ChatMessage> _messages = [];
  int _unreadCount = 0;
  bool _isLoading = false;
  bool _isInitialized = false;
  bool _isViewingThread = false;
  String? _errorMessage;
  String _currentUserId = '';
  String _counterpartyId = '';
  String? _activeGroupId;
  List<ChatRoom> _rooms = [];
  io.Socket? _socket;

  List<ChatMessage> get messages => _messages;
  int get unreadCount => _unreadCount;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  String get currentUserId => _currentUserId;
  String get counterpartyId => _counterpartyId;
  String? get activeGroupId => _activeGroupId;
  List<ChatRoom> get rooms => _rooms;

  Future<void> initializeChat() async {
    if (_isInitialized) {
      return;
    }

    final session = await _sessionService.getCurrentUser();
    if (session.token.isEmpty || session.userId.isEmpty) {
      return;
    }

    _currentUserId = session.userId;
    _isInitialized = true;

    await _refreshThread(notify: false);
    await refreshUnreadCount(notify: false);
    await _connectSocket(session.token);
    notifyListeners();
  }

  Future<void> enterThread() async {
    _isViewingThread = true;
    await initializeChat();
    await _refreshThread();
    await markThreadRead();
  }

  void leaveThread() {
    _isViewingThread = false;
    _activeGroupId = null;
    _messages = [];
  }

  Future<void> fetchGroups() async {
    _isLoading = true;
    notifyListeners();
    try {
      _rooms = await _messageService.fetchGroups();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> enterRoom(String roomId) async {
    _isViewingThread = true;
    _activeGroupId = roomId;
    await initializeChat();
    await _refreshThread();
    await markThreadRead();
  }

  Future<void> refresh() async {
    await _refreshThread();
    await refreshUnreadCount();
    await fetchGroups();
  }

  Future<void> refreshUnreadCount({bool notify = true}) async {
    try {
      _unreadCount = await _messageService.fetchUnreadCount();
      if (notify) {
        notifyListeners();
      }
    } catch (_) {
      // Keep the current badge count if the refresh fails.
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
        message = await _messageService.sendRoomMessage(_activeGroupId!, trimmed);
      } else {
        message = await _messageService.sendThreadMessage(trimmed);
      }
      _errorMessage = null;
      _upsertMessage(message);
      notifyListeners();
    } catch (error) {
      _errorMessage = error.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> markThreadRead() async {
    try {
      if (_activeGroupId != null) {
        await _messageService.markRoomThreadRead(_activeGroupId!);
        _markMessagesRead(_messages.map((e) => e.messageId).toList());
        _recalculateUnreadCount();
        notifyListeners();
        return;
      }
      
      final result = await _messageService.markThreadRead();
      if (result.messageIds.isNotEmpty) {
        _markMessagesRead(result.messageIds);
        _recalculateUnreadCount();
        notifyListeners();
      } else {
        await refreshUnreadCount();
      }
    } catch (_) {
      // Keep local state unchanged if marking as read fails.
    }
  }

  Future<void> _refreshThread({bool notify = true}) async {
    _isLoading = true;
    _errorMessage = null;
    if (notify) {
      notifyListeners();
    }

    try {
      if (_activeGroupId != null) {
        _messages = await _messageService.fetchRoomThread(_activeGroupId!);
      } else {
        final result = await _messageService.fetchThread();
        _counterpartyId = result.counterpartyId;
        _messages = result.items.toList();
      }
      _messages.sort((left, right) => right.sentAt.compareTo(left.sentAt));
      _recalculateUnreadCount();
    } catch (error) {
      _errorMessage = error.toString();
    } finally {
      _isLoading = false;
      if (notify) {
        notifyListeners();
      }
    }
  }

  Future<void> _connectSocket(String token) async {
    if (_socket != null && _socket!.connected) {
      return;
    }

    _socket = io.io(AppConfig.apiBaseUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'auth': {'token': token},
    });

    _socket!.connect();

    _socket!.onConnect((_) {
      debugPrint('Messaging socket connected.');
    });

    _socket!.on('message:new', (data) {
      final payload = _castMap(data);
      if (payload == null) {
        return;
      }

      final message = ChatMessage.fromJson(payload);
      _upsertMessage(message);
      _recalculateUnreadCount();
      notifyListeners();

      final shouldAutoRead =
          _isViewingThread &&
          message.senderId == _counterpartyId &&
          message.receiverId == _currentUserId &&
          !message.isRead;

      if (shouldAutoRead) {
        markThreadRead();
      }
    });

    _socket!.on('message:read', (data) {
      final payload = _castMap(data);
      if (payload == null) {
        return;
      }

      final messageIds = ((payload['messageIds'] as List<dynamic>?) ?? const [])
          .map((item) => item.toString())
          .where((item) => item.isNotEmpty)
          .toList();

      if (messageIds.isEmpty) {
        return;
      }

      _markMessagesRead(messageIds);
      _recalculateUnreadCount();
      notifyListeners();
    });
  }

  void _upsertMessage(ChatMessage message) {
    final existingIndex = _messages.indexWhere(
      (item) => item.messageId == message.messageId,
    );

    if (existingIndex >= 0) {
      _messages[existingIndex] = message;
    } else {
      _messages.insert(0, message);
    }

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

  void _recalculateUnreadCount() {
    _unreadCount = _messages
        .where(
          (message) => message.receiverId == _currentUserId && !message.isRead,
        )
        .length;
  }

  Map<String, dynamic>? _castMap(dynamic value) {
    if (value is Map<String, dynamic>) {
      return value;
    }

    if (value is Map) {
      return value.map((key, mapValue) => MapEntry(key.toString(), mapValue));
    }

    return null;
  }

  @override
  void dispose() {
    _socket?.disconnect();
    _socket?.dispose();
    super.dispose();
  }
}
