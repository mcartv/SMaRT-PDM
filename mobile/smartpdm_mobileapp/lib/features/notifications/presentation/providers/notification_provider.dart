import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:smartpdm_mobileapp/core/config/app_config.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/program_opening_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/data/services/notification_service.dart';
import 'package:smartpdm_mobileapp/features/profile/data/services/profile_service.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';

class NotificationProvider extends ChangeNotifier {
  NotificationProvider({
    NotificationService? notificationService,
    ProgramOpeningService? programOpeningService,
    ProfileService? profileService,
    SessionService? sessionService,
  }) : _notificationService = notificationService ?? NotificationService(),
       _programOpeningService =
           programOpeningService ?? ProgramOpeningService(),
       _profileService = profileService ?? ProfileService(),
       _sessionService = sessionService ?? const SessionService();

  final NotificationService _notificationService;
  final ProgramOpeningService _programOpeningService;
  final ProfileService _profileService;
  final SessionService _sessionService;

  List<AppNotification> _notifications = [];
  AppNotification? _latestPendingOpeningUpdate;
  bool _isLoading = false;
  String? _errorMessage;
  int _unreadCount = 0;
  bool _isInitialized = false;
  bool _hasScholarAccess = false;
  int _scholarAccessRevision = 0;
  String _initializedUserId = '';
  io.Socket? _socket;

  List<AppNotification> get notifications => _notifications;
  List<AppNotification> get officeUpdatesItems => _composeOfficeUpdates();
  List<AppNotification> get generalNotificationItems =>
      _notifications.where((item) => !item.isOfficeUpdate).toList();
  List<AppNotification> get homeOfficeUpdatesItems =>
      officeUpdatesItems.take(2).toList();
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  int get unreadCount => _unreadCount;
  bool get hasScholarAccess => _hasScholarAccess;
  int get scholarAccessRevision => _scholarAccessRevision;

  Future<void> initialize() async {
    final session = await _sessionService.getCurrentUser();

    if (session.token.isEmpty) {
      _resetRuntimeState(notify: false);
      return;
    }

    if (_isInitialized && _initializedUserId == session.userId) {
      return;
    }

    _resetRuntimeState(notify: false);
    _isInitialized = true;
    _initializedUserId = session.userId;
    _hasScholarAccess = session.hasScholarAccess;
    notifyListeners();

    await refresh();
    await _refreshScholarAccessFromProfile();
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
      try {
        _latestPendingOpeningUpdate = await _programOpeningService
            .fetchLatestOpeningOfficeUpdate();
      } catch (_) {
        _latestPendingOpeningUpdate = null;
      }
      if (_notifications.any(_isScholarApprovalNotification)) {
        await _applyScholarAccess(true);
      }
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

    _socket?.disconnect();
    _socket?.dispose();
    _socket = io.io(AppConfig.apiBaseUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'auth': {'token': session.token},
    });

    _socket!.connect();

    _socket!.onConnect((_) {
      debugPrint('Notification socket connected.');
    });

    _socket!.on('notification:new', (data) async {
      final payload = _castMap(data);
      if (payload == null) return;

      final notification = AppNotification.fromJson(payload);

      if (_isScholarApprovalNotification(notification)) {
        await _applyScholarAccess(true);
      }

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

  Future<void> _refreshScholarAccessFromProfile() async {
    try {
      final profile = await _profileService.fetchMyProfile();
      await _applyScholarAccess(profile['has_scholar_access'] == true);
      notifyListeners();
    } catch (_) {
      // Keep the cached scholar access state if the profile refresh fails.
    }
  }

  Future<void> _applyScholarAccess(bool nextValue) async {
    if (_hasScholarAccess == nextValue) {
      await _sessionService.saveScholarAccess(hasScholarAccess: nextValue);
      return;
    }

    _hasScholarAccess = nextValue;
    _scholarAccessRevision += 1;
    await _sessionService.saveScholarAccess(hasScholarAccess: nextValue);
  }

  bool _isScholarApprovalNotification(AppNotification notification) {
    final normalizedType = notification.type.toLowerCase();
    final normalizedTitle = notification.title.toLowerCase();
    final normalizedReference = (notification.referenceType ?? '').toLowerCase();

    return normalizedReference == 'scholar' &&
        (normalizedType == 'scholar approved' ||
            normalizedTitle == 'scholarship approved');
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

  List<AppNotification> _composeOfficeUpdates() {
    final officeUpdates = _notifications
        .where((item) => item.isOfficeUpdate)
        .toList();

    if (_latestPendingOpeningUpdate == null) {
      return officeUpdates;
    }

    final latestReferenceId = _latestPendingOpeningUpdate!.referenceId;
    final deduped = officeUpdates.where((item) {
      if (!item.isOpeningUpdate) {
        return true;
      }

      if (latestReferenceId == null || latestReferenceId.isEmpty) {
        return true;
      }

      return item.referenceId != latestReferenceId;
    }).toList();

    return [_latestPendingOpeningUpdate!, ...deduped];
  }

  void _resetRuntimeState({bool notify = true}) {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _notifications = [];
    _latestPendingOpeningUpdate = null;
    _isLoading = false;
    _errorMessage = null;
    _unreadCount = 0;
    _isInitialized = false;
    _hasScholarAccess = false;
    _scholarAccessRevision = 0;
    _initializedUserId = '';

    if (notify) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _socket?.disconnect();
    _socket?.dispose();
    super.dispose();
  }
}
