import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_events.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';
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
  bool _isInitialized = false;
  bool _hasScholarAccess = false;
  bool _isRealtimeRefreshing = false;
  bool _hasQueuedRealtimeRefresh = false;

  String? _errorMessage;
  String _initializedUserId = '';

  int _unreadCount = 0;
  int _scholarAccessRevision = 0;
  int _applicationRevision = 0;
  int _announcementRevision = 0;
  int _openingRevision = 0;
  int _payoutRevision = 0;
  int _renewalRevision = 0;
  int _scholarRevision = 0;
  int _ticketRevision = 0;
  int _roRevision = 0;

  VoidCallback? _stopRealtimeListener;

  List<AppNotification> get notifications => _notifications;

  List<AppNotification> get officeUpdatesItems => _composeOfficeUpdates();

  List<AppNotification> get generalNotificationItems =>
      _notifications.where((item) => !item.isOfficeUpdate).toList();

  List<AppNotification> get homeOfficeUpdatesItems =>
      officeUpdatesItems.take(2).toList();

  bool get isLoading => _isLoading;
  bool get hasScholarAccess => _hasScholarAccess;

  String? get errorMessage => _errorMessage;

  int get unreadCount => _unreadCount;

  int get unreadPayoutCount => _notifications
      .where((item) => item.isPayoutNotification && !item.isRead)
      .length;

  int get scholarAccessRevision => _scholarAccessRevision;
  int get applicationRevision => _applicationRevision;
  int get announcementRevision => _announcementRevision;
  int get openingRevision => _openingRevision;
  int get payoutRevision => _payoutRevision;
  int get renewalRevision => _renewalRevision;
  int get scholarRevision => _scholarRevision;
  int get ticketRevision => _ticketRevision;
  int get roRevision => _roRevision;

  Future<void> initialize() async {
    final session = await _sessionService.getCurrentUser();

    if (session.token.isEmpty) {
      _resetRuntimeState(notify: false);
      return;
    }

    if (_isInitialized && _initializedUserId == session.userId) {
      _ensureRealtimeListener();
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

    _ensureRealtimeListener();
  }

  Future<void> refresh({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
    }

    try {
      final result = await _notificationService.fetchNotifications();
      _notifications = result.items;

      await _refreshLatestOpeningUpdate();

      if (_notifications.any(_isScholarApprovalNotification)) {
        await _applyScholarAccess(true);
      }

      _recalculateUnreadCount();
      _errorMessage = null;
    } catch (error) {
      _errorMessage = error.toString().replaceFirst('Exception: ', '');
    } finally {
      if (!silent) {
        _isLoading = false;
      }

      notifyListeners();
    }
  }

  Future<void> refreshUnreadCount() async {
    try {
      _unreadCount = await _notificationService.fetchUnreadCount();
      notifyListeners();
    } catch (_) {
      // Keep current badge count when count refresh fails.
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
      _errorMessage = error.toString().replaceFirst('Exception: ', '');
      notifyListeners();
    }
  }

  Future<void> markAllAsRead() async {
    if (_isLoading) return;

    try {
      _isLoading = true;
      notifyListeners();

      await _notificationService.markAllAsRead();

      _notifications = _notifications
          .map((item) => item.copyWith(isRead: true))
          .toList(growable: false);

      _unreadCount = 0;
      _errorMessage = null;
    } catch (error) {
      _errorMessage = error.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;

      WidgetsBinding.instance.addPostFrameCallback((_) {
        notifyListeners();
      });
    }
  }

  Future<void> markPayoutNotificationsAsRead() async {
    try {
      final payoutNotifications = _notifications
          .where((item) => item.isPayoutNotification && !item.isRead)
          .toList();

      for (final notification in payoutNotifications) {
        await _notificationService.markAsRead(notification.notificationId);
      }

      _notifications = _notifications.map((notification) {
        if (notification.isPayoutNotification) {
          return notification.copyWith(isRead: true);
        }

        return notification;
      }).toList();

      _recalculateUnreadCount();
      notifyListeners();
    } catch (error) {
      _errorMessage = error.toString().replaceFirst('Exception: ', '');
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
      _errorMessage = error.toString().replaceFirst('Exception: ', '');
      notifyListeners();
    }
  }

  void _ensureRealtimeListener() {
    _stopRealtimeListener ??= MobileRealtimeService.instance.listenTo(
      MobileRealtimeEvents.notificationProviderEvents,
      _handleRealtimeEvent,
    );
  }

  Future<void> _handleRealtimeEvent(MobileRealtimeEvent event) async {
    debugPrint('[NotificationProvider] realtime event: ${event.name}');

    switch (event.name) {
      case MobileRealtimeEvents.notificationNew:
      case MobileRealtimeEvents.notificationCreated:
        await _upsertNotificationFromEvent(event);
        await _refreshOfficeUpdatesFromRealtime();
        return;

      case MobileRealtimeEvents.notificationUpdated:
        await _updateNotificationFromEvent(event);
        await _refreshOfficeUpdatesFromRealtime();
        return;

      case MobileRealtimeEvents.notificationDeleted:
      case MobileRealtimeEvents.notificationArchived:
        _removeNotificationFromEvent(event);
        await _refreshOfficeUpdatesFromRealtime();
        return;

      case MobileRealtimeEvents.notificationRestored:
        await _refreshOfficeUpdatesFromRealtime();
        return;

      case MobileRealtimeEvents.notificationReadAll:
        _markLocalNotificationsRead();
        return;

      case MobileRealtimeEvents.announcementCreated:
      case MobileRealtimeEvents.announcementUpdated:
      case MobileRealtimeEvents.announcementPublished:
      case MobileRealtimeEvents.announcementRestored:
      case MobileRealtimeEvents.announcementRefresh:
        _announcementRevision += 1;
        await _refreshOfficeUpdatesFromRealtime();
        return;

      case MobileRealtimeEvents.announcementArchived:
      case MobileRealtimeEvents.announcementDeleted:
        _announcementRevision += 1;
        _removeOfficeUpdateByReference(
          referenceId: event.referenceId,
          referenceType: 'announcement',
        );
        await _refreshOfficeUpdatesFromRealtime();
        return;

      case MobileRealtimeEvents.openingCreated:
      case MobileRealtimeEvents.openingUpdated:
      case MobileRealtimeEvents.openingClosed:
      case MobileRealtimeEvents.openingRestored:
        _openingRevision += 1;
        await _refreshOfficeUpdatesFromRealtime();
        return;

      case MobileRealtimeEvents.openingArchived:
        _openingRevision += 1;
        _removeOfficeUpdateByReference(
          referenceId: event.referenceId,
          referenceType: 'opening',
        );
        _removeOfficeUpdateByReference(
          referenceId: event.referenceId,
          referenceType: 'program_opening',
        );
        await _refreshOfficeUpdatesFromRealtime();
        return;

      case MobileRealtimeEvents.applicationCreated:
      case MobileRealtimeEvents.applicationUpdated:
      case MobileRealtimeEvents.applicationRejected:
      case MobileRealtimeEvents.applicationDisqualified:
      case MobileRealtimeEvents.applicationDocumentUploaded:
      case MobileRealtimeEvents.applicationDocumentReviewed:
      case MobileRealtimeEvents.applicationOcrQueued:
      case MobileRealtimeEvents.applicationOcrSnapshotSaved:
      case MobileRealtimeEvents.endorsementUpdated:
        _applicationRevision += 1;
        notifyListeners();
        return;

      case MobileRealtimeEvents.applicationApproved:
        _applicationRevision += 1;
        await _refreshScholarAccessFromProfile();
        notifyListeners();
        return;

      case MobileRealtimeEvents.renewalCreated:
      case MobileRealtimeEvents.renewalUpdated:
      case MobileRealtimeEvents.renewalRejected:
        _renewalRevision += 1;
        notifyListeners();
        return;

      case MobileRealtimeEvents.renewalApproved:
        _renewalRevision += 1;
        _scholarRevision += 1;
        notifyListeners();
        return;

      case MobileRealtimeEvents.scholarCreated:
      case MobileRealtimeEvents.scholarUpdated:
      case MobileRealtimeEvents.scholarArchived:
      case MobileRealtimeEvents.scholarRestored:
        _scholarRevision += 1;
        await _refreshScholarAccessFromProfile();
        notifyListeners();
        return;

      case MobileRealtimeEvents.roCreated:
      case MobileRealtimeEvents.roUpdated:
      case MobileRealtimeEvents.roCleared:
      case MobileRealtimeEvents.roProgressUpdated:
      case MobileRealtimeEvents.roTimeIn:
      case MobileRealtimeEvents.roTimeOut:
      case MobileRealtimeEvents.roLogCreated:
      case MobileRealtimeEvents.roLogUpdated:
      case MobileRealtimeEvents.roSettingsUpdated:
        _roRevision += 1;
        notifyListeners();
        return;

      case MobileRealtimeEvents.payoutCreated:
      case MobileRealtimeEvents.payoutUpdated:
      case MobileRealtimeEvents.payoutDeleted:
      case MobileRealtimeEvents.payoutArchived:
      case MobileRealtimeEvents.payoutRestored:
      case MobileRealtimeEvents.scholarReleased:
        _payoutRevision += 1;
        await _refreshOfficeUpdatesFromRealtime();
        return;

      case MobileRealtimeEvents.ticketCreated:
      case MobileRealtimeEvents.ticketUpdated:
      case MobileRealtimeEvents.ticketResolved:
      case MobileRealtimeEvents.ticketArchived:
      case MobileRealtimeEvents.ticketRestored:
        _ticketRevision += 1;
        notifyListeners();
        return;

      default:
        return;
    }
  }

  Future<void> _refreshOfficeUpdatesFromRealtime() async {
    if (_isRealtimeRefreshing) {
      _hasQueuedRealtimeRefresh = true;
      return;
    }

    _isRealtimeRefreshing = true;

    try {
      debugPrint(
        '[NotificationProvider] refreshing office updates from realtime',
      );

      final result = await _notificationService.fetchNotifications();
      _notifications = result.items;

      await _refreshLatestOpeningUpdate();

      if (_notifications.any(_isScholarApprovalNotification)) {
        await _applyScholarAccess(true);
      }

      _recalculateUnreadCount();
      _errorMessage = null;

      notifyListeners();
    } catch (error) {
      debugPrint('OFFICE UPDATES REALTIME REFRESH ERROR: $error');
    } finally {
      _isRealtimeRefreshing = false;
    }

    if (_hasQueuedRealtimeRefresh) {
      _hasQueuedRealtimeRefresh = false;
      await _refreshOfficeUpdatesFromRealtime();
    }
  }

  Future<void> _refreshLatestOpeningUpdate() async {
    try {
      _latestPendingOpeningUpdate = await _programOpeningService
          .fetchLatestOpeningOfficeUpdate();
    } catch (_) {
      _latestPendingOpeningUpdate = null;
    }
  }

  Future<void> _upsertNotificationFromEvent(MobileRealtimeEvent event) async {
    final payload = event.payload;
    if (payload.isEmpty) return;

    try {
      final notification = AppNotification.fromJson(payload);

      if (_isScholarApprovalNotification(notification)) {
        await _applyScholarAccess(true);
      }

      if (notification.isAnnouncementNotification) {
        _announcementRevision += 1;
      }

      if (notification.isOpeningUpdate) {
        _openingRevision += 1;
      }

      if (notification.isPayoutNotification) {
        _payoutRevision += 1;
      }

      _notifications = [
        notification,
        ..._notifications.where(
          (item) => item.notificationId != notification.notificationId,
        ),
      ];

      _recalculateUnreadCount();
      notifyListeners();
    } catch (error) {
      debugPrint('UPSERT REALTIME NOTIFICATION ERROR: $error');
    }
  }

  Future<void> _updateNotificationFromEvent(MobileRealtimeEvent event) async {
    final payload = event.payload;
    if (payload.isEmpty) return;

    try {
      final updated = AppNotification.fromJson(payload);

      if (updated.isAnnouncementNotification) {
        _announcementRevision += 1;
      }

      if (updated.isOpeningUpdate) {
        _openingRevision += 1;
      }

      if (updated.isPayoutNotification) {
        _payoutRevision += 1;
      }

      _notifications = _notifications.map((notification) {
        return notification.notificationId == updated.notificationId
            ? updated
            : notification;
      }).toList();

      _recalculateUnreadCount();
      notifyListeners();
    } catch (error) {
      debugPrint('UPDATE REALTIME NOTIFICATION ERROR: $error');
    }
  }

  void _removeNotificationFromEvent(MobileRealtimeEvent event) {
    final notificationId =
        event.payload['notificationId']?.toString() ??
        event.payload['notification_id']?.toString() ??
        event.referenceId;

    if (notificationId.trim().isEmpty) return;

    _notifications = _notifications
        .where((notification) => notification.notificationId != notificationId)
        .toList();

    _recalculateUnreadCount();
    notifyListeners();
  }

  void _markLocalNotificationsRead() {
    _notifications = _notifications
        .map((item) => item.copyWith(isRead: true))
        .toList(growable: false);

    _unreadCount = 0;
    notifyListeners();
  }

  void _removeOfficeUpdateByReference({
    required String referenceId,
    required String referenceType,
  }) {
    final targetReferenceId = referenceId.trim();
    final targetReferenceType = referenceType.trim().toLowerCase();

    if (targetReferenceId.isEmpty) return;

    _notifications = _notifications.where((notification) {
      final itemReferenceId = (notification.referenceId ?? '').trim();
      final itemReferenceType = (notification.referenceType ?? '')
          .trim()
          .toLowerCase();
      final itemType = notification.type.trim().toLowerCase();

      final sameReferenceId = itemReferenceId == targetReferenceId;
      final sameReferenceType =
          itemReferenceType == targetReferenceType ||
          itemType == targetReferenceType ||
          itemType.contains(targetReferenceType);

      return !(sameReferenceId && sameReferenceType);
    }).toList();

    _recalculateUnreadCount();
    notifyListeners();
  }

  Future<void> _refreshScholarAccessFromProfile() async {
    try {
      final profile = await _profileService.fetchMyProfile();
      await _applyScholarAccess(profile['has_scholar_access'] == true);
      notifyListeners();
    } catch (_) {
      // Keep cached scholar access when profile refresh fails.
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
    final normalizedReference = (notification.referenceType ?? '')
        .toLowerCase();

    return normalizedReference == 'scholar' &&
        (normalizedType == 'scholar approved' ||
            normalizedTitle == 'scholarship approved');
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
    _stopRealtimeListener?.call();
    _stopRealtimeListener = null;

    _notifications = [];
    _latestPendingOpeningUpdate = null;

    _isLoading = false;
    _isInitialized = false;
    _hasScholarAccess = false;
    _isRealtimeRefreshing = false;
    _hasQueuedRealtimeRefresh = false;

    _errorMessage = null;
    _initializedUserId = '';

    _unreadCount = 0;
    _scholarAccessRevision = 0;
    _applicationRevision = 0;
    _announcementRevision = 0;
    _openingRevision = 0;
    _payoutRevision = 0;
    _renewalRevision = 0;
    _scholarRevision = 0;
    _ticketRevision = 0;
    _roRevision = 0;

    if (notify) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _stopRealtimeListener?.call();
    _stopRealtimeListener = null;
    super.dispose();
  }
}
