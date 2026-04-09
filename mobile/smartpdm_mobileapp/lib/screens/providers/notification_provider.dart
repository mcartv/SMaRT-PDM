import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:smartpdm_mobileapp/config/app_config.dart';
import 'package:smartpdm_mobileapp/models/app_notification.dart';
import 'package:smartpdm_mobileapp/services/notification_service.dart';
import 'package:smartpdm_mobileapp/services/session_service.dart';

class NotificationProvider extends ChangeNotifier {
  NotificationProvider({
    NotificationService? notificationService,
    SessionService? sessionService,
  }) : _notificationService = notificationService ?? NotificationService(),
       _sessionService = sessionService ?? const SessionService();

  final NotificationService _notificationService;
  final SessionService _sessionService;

  List<AppNotification> _notifications = [];
  bool _isLoading = false;
  String? _errorMessage;
  int _unreadCount = 0;
  bool _isInitialized = false;
  io.Socket? _socket;

  List<AppNotification> get notifications => _notifications;
  List<AppNotification> get officeUpdatesItems =>
      _notifications.where((item) => item.isOfficeUpdate).toList();
  List<AppNotification> get generalNotificationItems =>
      _notifications.where((item) => !item.isOfficeUpdate).toList();
  List<AppNotification> get homeOfficeUpdatesItems =>
      officeUpdatesItems.take(2).toList();
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  int get unreadCount => _unreadCount;

  Future<void> initialize() async {
    if (_isInitialized) {
      return;
    }

    _isInitialized = true;
    await refresh();
    await _notificationService.registerStoredDeviceToken();
    await _connectSocket();
  }

  Future<void> refresh() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _notificationService.fetchNotifications();
      _notifications = result.items;
      _unreadCount = _notifications.where((item) => !item.isRead).length;
    } catch (error) {
      _errorMessage = error.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> refreshUnreadCount() async {
    try {
      _unreadCount = await _notificationService.fetchUnreadCount();
      notifyListeners();
    } catch (_) {
      // Keep the existing badge if the count refresh fails.
    }
  }

  Future<void> markAsRead(String notificationId) async {
    try {
      final updated = await _notificationService.markAsRead(notificationId);
      _notifications = _notifications.map((notification) {
        return notification.notificationId == notificationId
            ? updated
            : notification;
      }).toList();
      _recalculateUnreadCount();
      notifyListeners();
    } catch (error) {
      _errorMessage = error.toString();
      notifyListeners();
    }
  }

  Future<void> markAllAsRead() async {
    try {
      await _notificationService.markAllAsRead();
      _notifications = _notifications
          .map((notification) => notification.copyWith(isRead: true))
          .toList();
      _recalculateUnreadCount();
      notifyListeners();
    } catch (error) {
      _errorMessage = error.toString();
      notifyListeners();
    }
  }

  Future<void> deleteNotification(String notificationId) async {
    try {
      await _notificationService.deleteNotification(notificationId);
      _notifications = _notifications
          .where(
            (notification) => notification.notificationId != notificationId,
          )
          .toList();
      _recalculateUnreadCount();
      notifyListeners();
    } catch (error) {
      _errorMessage = error.toString();
      notifyListeners();
    }
  }

  Future<void> _connectSocket() async {
    final session = await _sessionService.getCurrentUser();
    if (session.token.isEmpty) {
      return;
    }

    if (_socket != null && _socket!.connected) {
      return;
    }

    _socket = io.io(AppConfig.apiBaseUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'auth': {'token': session.token},
    });

    _socket!.connect();

    _socket!.onConnect((_) {
      debugPrint('Notification socket connected.');
    });

    _socket!.on('notification:new', (data) {
      final payload = _castMap(data);
      if (payload == null) return;

      final notification = AppNotification.fromJson(payload);
      _notifications = [
        notification,
        ..._notifications.where(
          (item) => item.notificationId != notification.notificationId,
        ),
      ];
      _recalculateUnreadCount();
      notifyListeners();
    });

    _socket!.on('notification:updated', (data) {
      final payload = _castMap(data);
      if (payload == null) return;

      final updated = AppNotification.fromJson(payload);
      _notifications = _notifications.map((notification) {
        return notification.notificationId == updated.notificationId
            ? updated
            : notification;
      }).toList();
      _recalculateUnreadCount();
      notifyListeners();
    });

    _socket!.on('notification:deleted', (data) {
      final payload = _castMap(data);
      final notificationId = payload?['notificationId']?.toString();
      if (notificationId == null || notificationId.isEmpty) {
        return;
      }

      _notifications = _notifications
          .where(
            (notification) => notification.notificationId != notificationId,
          )
          .toList();
      _recalculateUnreadCount();
      notifyListeners();
    });
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

  void _recalculateUnreadCount() {
    _unreadCount = _notifications.where((item) => !item.isRead).length;
  }

  @override
  void dispose() {
    _socket?.disconnect();
    _socket?.dispose();
    super.dispose();
  }
}
