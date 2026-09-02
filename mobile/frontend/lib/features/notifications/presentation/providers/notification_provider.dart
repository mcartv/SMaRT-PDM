import 'dart:async';

import 'package:flutter/widgets.dart';

import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_events.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/announcement_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/program_opening_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/data/services/notification_service.dart';
import 'package:smartpdm_mobileapp/features/profile/data/services/profile_service.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';

class NotificationProvider extends ChangeNotifier {
  NotificationProvider({
    NotificationService? notificationService,
    AnnouncementService? announcementService,
    ProgramOpeningService? programOpeningService,
    ProfileService? profileService,
    SessionService? sessionService,
  }) : _notificationService = notificationService ?? NotificationService(),
       _announcementService = announcementService ?? AnnouncementService(),
       _programOpeningService =
           programOpeningService ?? ProgramOpeningService(),
       _profileService = profileService ?? ProfileService(),
       _sessionService = sessionService ?? const SessionService();

  final NotificationService _notificationService;
  final AnnouncementService _announcementService;
  final ProgramOpeningService _programOpeningService;
  final ProfileService _profileService;
  final SessionService _sessionService;

  List<AppNotification> _notifications = <AppNotification>[];
  List<AppNotification> _announcementNotifications = <AppNotification>[];
  AppNotification? _latestPendingOpeningUpdate;

  bool _isLoading = false;
  bool _isInitialized = false;
  bool _hasScholarAccess = false;
  bool _isRealtimeBridgeHealthy = false;
  bool _isRealtimeRefreshing = false;
  bool _hasQueuedRealtimeRefresh = false;
  Timer? _realtimeRefreshDebounce;
  Timer? _realtimeSafetyTimer;
  Completer<void>? _realtimeRefreshCompleter;
  static const Duration _realtimeRefreshCoalesceWindow = Duration(
    milliseconds: 60,
  );

  Timer? _scholarAccessRefreshDebounce;
  Completer<void>? _scholarAccessRefreshCompleter;
  bool _isScholarAccessRefreshing = false;
  bool _hasQueuedScholarAccessRefresh = false;
  static const Duration _scholarAccessRefreshCoalesceWindow = Duration(
    milliseconds: 100,
  );
  String? _errorMessage;
  String _initializedUserId = '';

  int _unreadCount = 0;
  int _notificationMutationRevision = 0;
  Timer? _unreadCountRealtimeDebounce;
  static const Duration _unreadCountRealtimeCoalesceWindow = Duration(
    milliseconds: 250,
  );

  int _scholarAccessRevision = 0;
  int _scholarActivationRevision = 0;
  int _applicationRevision = 0;
  int _announcementRevision = 0;
  int _openingRevision = 0;
  int _payoutRevision = 0;
  int _renewalRevision = 0;
  int _scholarRevision = 0;
  int _ticketRevision = 0;
  int _roRevision = 0;
  int _settingsRevision = 0;
  int _profileRevision = 0;

  VoidCallback? _stopRealtimeListener;

  List<AppNotification> get notifications =>
      List.unmodifiable(_composeNotifications());

  List<AppNotification> get items => notifications;

  List<AppNotification> get officeUpdatesItems => _composeOfficeUpdates();

  List<AppNotification> get generalNotificationItems =>
      _notifications.where((item) => !item.isOfficeUpdate).toList();

  List<AppNotification> get homeOfficeUpdatesItems =>
      officeUpdatesItems.take(2).toList();

  List<AppNotification> get roItems =>
      _notifications.where((item) => item.isRoNotification).toList();

  bool get isLoading => _isLoading;

  bool get hasScholarAccess => _hasScholarAccess;

  String? get errorMessage => _errorMessage;

  String? get error => _errorMessage;

  bool get hasError => _errorMessage != null;

  int get unreadCount => _unreadCount;

  int get unreadPayoutCount => _notifications
      .where((item) => item.isPayoutNotification && !item.isRead)
      .length;

  int get scholarAccessRevision => _scholarAccessRevision;
  int get scholarActivationRevision => _scholarActivationRevision;
  int get applicationRevision => _applicationRevision;
  int get announcementRevision => _announcementRevision;
  int get openingRevision => _openingRevision;
  int get payoutRevision => _payoutRevision;
  int get renewalRevision => _renewalRevision;
  int get scholarRevision => _scholarRevision;
  int get ticketRevision => _ticketRevision;
  int get roRevision => _roRevision;
  int get settingsRevision => _settingsRevision;
  int get profileRevision => _profileRevision;

  Future<void> initialize() async {
    final session = await _sessionService.getCurrentUser();

    if (session.token.isEmpty) {
      _resetRuntimeState(notify: false);
      return;
    }

    if (_isInitialized && _initializedUserId == session.userId) {
      // Realtime already keeps this user's notification state current.
      // Re-entering the provider must not create another unread-count request.
      _ensureRealtimeListener();
      _ensureRealtimeSafetyTimer();
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
    _ensureRealtimeSafetyTimer();
  }

  Future<void> refresh({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
    }

    final notificationMutationRevisionAtStart = _notificationMutationRevision;

    try {
      final result = await _notificationService.fetchNotifications();

      // A realtime event can arrive while a REST refresh is in flight.
      // Never let an older HTTP response overwrite the newer socket state.
      if (notificationMutationRevisionAtStart ==
          _notificationMutationRevision) {
        _notifications = result.items;
      } else {
        debugPrint(
          'NOTIFICATION REFRESH SKIPPED STALE LIST: realtime changed during fetch',
        );
      }

      await _refreshPublishedAnnouncements();
      await _refreshLatestOpeningUpdate();

      if (_notifications.any(_isScholarApprovalNotification)) {
        await _applyScholarAccess(true);
      }

      await _refreshUnreadCountFromServerOrLocal();
      _errorMessage = null;
    } catch (error) {
      _errorMessage = error.toString().replaceFirst('Exception: ', '');
      _recalculateUnreadCount();
    } finally {
      if (!silent) {
        _isLoading = false;
      }

      notifyListeners();
    }
  }

  Future<void> refreshUnreadCount() async {
    await _refreshUnreadCountFromServerOrLocal();
    notifyListeners();
  }

  Future<void> markAsRead(String notificationId) async {
    try {
      final updated = await _notificationService.markAsRead(notificationId);

      _notifications = _notifications
          .map((notification) {
            return notification.notificationId == notificationId
                ? updated
                : notification;
          })
          .toList(growable: false);

      await _refreshUnreadCountFromServerOrLocal();
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

      _notifications = _notifications
          .map((notification) {
            if (notification.isPayoutNotification) {
              return notification.copyWith(isRead: true);
            }

            return notification;
          })
          .toList(growable: false);

      await _refreshUnreadCountFromServerOrLocal();
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
          .toList(growable: false);

      await _refreshUnreadCountFromServerOrLocal();
      notifyListeners();
    } catch (error) {
      _errorMessage = error.toString().replaceFirst('Exception: ', '');
      notifyListeners();
    }
  }

  void _ensureRealtimeSafetyTimer() {
    _realtimeSafetyTimer ??= Timer.periodic(const Duration(seconds: 20), (
      _,
    ) async {
      if (!_isInitialized || MobileRealtimeService.instance.isRealtimeHealthy) {
        return;
      }

      // Socket.IO can stay connected while the backend database-change
      // bridge is recovering. During that condition, do a low-frequency
      // authoritative reconciliation so no module remains stale. This timer
      // is completely idle while realtime is healthy.
      await _reconcileAllAfterSocketRecovery();
    });
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
      case MobileRealtimeEvents.socketConnected:
      case MobileRealtimeEvents.socketReconnected:
        _isRealtimeBridgeHealthy =
            MobileRealtimeService.instance.isRealtimeHealthy;
        // Realtime events are not replayed while a device is offline. Reconcile
        // every active mobile module from its authoritative API when the socket
        // comes back, then let each screen refresh only its own data.
        await _reconcileAllAfterSocketRecovery();
        return;

      case MobileRealtimeEvents.bridgeStatus:
        final healthy = MobileRealtimeService.instance.isRealtimeHealthy;
        final recovered = healthy && !_isRealtimeBridgeHealthy;
        _isRealtimeBridgeHealthy = healthy;
        if (recovered) {
          await _reconcileAllAfterSocketRecovery();
        }
        return;

      case MobileRealtimeEvents.socketDisconnected:
      case MobileRealtimeEvents.socketError:
        _isRealtimeBridgeHealthy = false;
        return;

      case MobileRealtimeEvents.settingsUpdated:
      case MobileRealtimeEvents.maintenanceUpdated:
      case MobileRealtimeEvents.faqUpdated:
        _settingsRevision += 1;
        notifyListeners();
        return;

      case MobileRealtimeEvents.programUpdated:
        _settingsRevision += 1;
        _openingRevision += 1;
        _renewalRevision += 1;
        _payoutRevision += 1;
        notifyListeners();
        unawaited(_refreshLatestOpeningUpdate());
        return;

      case MobileRealtimeEvents.academicUpdated:
        _settingsRevision += 1;
        _renewalRevision += 1;
        _payoutRevision += 1;
        _roRevision += 1;
        notifyListeners();
        return;

      case MobileRealtimeEvents.profileUpdated:
        _profileRevision += 1;
        _scholarRevision += 1;
        notifyListeners();
        unawaited(_queueScholarAccessRefresh());
        return;
      case MobileRealtimeEvents.notificationNew:
      case MobileRealtimeEvents.notificationCreated:
      case MobileRealtimeEvents.notificationCreatedLegacy:
        await _upsertNotificationFromEvent(event);
        return;

      case MobileRealtimeEvents.notificationUpdated:
      case MobileRealtimeEvents.notificationsUpdated:
      case MobileRealtimeEvents.notificationUpdatedLegacy:
      case MobileRealtimeEvents.notificationRead:
        await _updateNotificationFromEvent(event);
        return;

      case MobileRealtimeEvents.notificationDeleted:
      case MobileRealtimeEvents.notificationArchived:
        await _removeNotificationFromEvent(event);
        return;

      case MobileRealtimeEvents.notificationRestored:
        await _upsertNotificationFromEvent(event);
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
        notifyListeners();
        unawaited(_refreshOfficeUpdatesFromRealtime());
        return;

      case MobileRealtimeEvents.announcementArchived:
      case MobileRealtimeEvents.announcementDeleted:
        _announcementRevision += 1;
        _removeOfficeUpdateByReference(
          referenceId: event.referenceId,
          referenceType: 'announcement',
        );
        notifyListeners();
        unawaited(_refreshOfficeUpdatesFromRealtime());
        return;

      case MobileRealtimeEvents.openingCreated:
      case MobileRealtimeEvents.openingUpdated:
      case MobileRealtimeEvents.openingClosed:
      case MobileRealtimeEvents.openingRestored:
        _openingRevision += 1;
        notifyListeners();
        unawaited(_refreshOfficeUpdatesFromRealtime());
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
        notifyListeners();
        unawaited(_refreshOfficeUpdatesFromRealtime());
        return;

      case MobileRealtimeEvents.applicationCreated:
      case MobileRealtimeEvents.applicationDocumentUploaded:
      case MobileRealtimeEvents.applicationDocumentReviewed:
      case MobileRealtimeEvents.applicationOcrQueued:
      case MobileRealtimeEvents.applicationOcrSnapshotSaved:
      case MobileRealtimeEvents.endorsementUpdated:
        _applicationRevision += 1;
        notifyListeners();
        return;

      case MobileRealtimeEvents.applicationUpdated:
      case MobileRealtimeEvents.applicationRejected:
      case MobileRealtimeEvents.applicationDisqualified:
      case MobileRealtimeEvents.applicationApproved:
        _applicationRevision += 1;
        notifyListeners();

        if (_isTargetedScholarAccessGrant(event)) {
          if (!_hasScholarAccess) {
            _scholarActivationRevision += 1;
          }
          await _applyScholarAccess(true);
        }

        unawaited(_queueScholarAccessRefresh());
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
        _profileRevision += 1;
        notifyListeners();
        unawaited(_queueScholarAccessRefresh());
        return;

      case MobileRealtimeEvents.roCreated:
      case MobileRealtimeEvents.roAssigned:
      case MobileRealtimeEvents.roAcknowledged:
      case MobileRealtimeEvents.roConflictReported:
      case MobileRealtimeEvents.roUpdated:
      case MobileRealtimeEvents.roUpdatedLegacy:
      case MobileRealtimeEvents.roCleared:
      case MobileRealtimeEvents.roProgressUpdated:
      case MobileRealtimeEvents.roTimeIn:
      case MobileRealtimeEvents.roTimeOut:
      case MobileRealtimeEvents.roLogCreated:
      case MobileRealtimeEvents.roLogUpdated:
      case MobileRealtimeEvents.roSettingsUpdated:
      case MobileRealtimeEvents.roAssignmentUpdated:
      case MobileRealtimeEvents.roTimeLogUpdated:
      case MobileRealtimeEvents.roProofUpdated:
        _roRevision += 1;
        notifyListeners();
        return;

      case MobileRealtimeEvents.payoutCreated:
      case MobileRealtimeEvents.payoutUpdated:
      case MobileRealtimeEvents.payoutDeleted:
      case MobileRealtimeEvents.payoutArchived:
      case MobileRealtimeEvents.payoutRestored:
      case MobileRealtimeEvents.scholarReleased:
      case MobileRealtimeEvents.payoutProofSubmitted:
      case MobileRealtimeEvents.payoutProofReviewed:
        _payoutRevision += 1;
        notifyListeners();
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

  Future<void> _reconcileAllAfterSocketRecovery() async {
    try {
      await refresh(silent: true);
    } catch (_) {
      // Individual screens keep their current data when reconciliation fails.
    }

    _applicationRevision += 1;
    _announcementRevision += 1;
    _openingRevision += 1;
    _payoutRevision += 1;
    _renewalRevision += 1;
    _scholarRevision += 1;
    _roRevision += 1;
    _settingsRevision += 1;
    _profileRevision += 1;

    await _queueScholarAccessRefresh();
    notifyListeners();
  }

  Future<void> _refreshOfficeUpdatesFromRealtime() {
    if (_isRealtimeRefreshing) {
      _hasQueuedRealtimeRefresh = true;
      return Future<void>.value();
    }

    _realtimeRefreshDebounce?.cancel();

    final completer = _realtimeRefreshCompleter ??= Completer<void>();

    _realtimeRefreshDebounce = Timer(_realtimeRefreshCoalesceWindow, () async {
      _realtimeRefreshDebounce = null;
      _isRealtimeRefreshing = true;

      try {
        // Notifications themselves are already applied from their socket
        // payload. Only reconcile the two server-backed Office Update sources.
        await Future.wait<void>([
          _refreshPublishedAnnouncements(),
          _refreshLatestOpeningUpdate(),
        ]);

        _recalculateUnreadCount();
        _errorMessage = null;
        notifyListeners();
      } catch (error) {
        debugPrint('OFFICE UPDATE REALTIME REFRESH ERROR: $error');
      } finally {
        _isRealtimeRefreshing = false;

        final pendingCompleter = _realtimeRefreshCompleter;
        _realtimeRefreshCompleter = null;
        if (pendingCompleter != null && !pendingCompleter.isCompleted) {
          pendingCompleter.complete();
        }
      }

      if (_hasQueuedRealtimeRefresh) {
        _hasQueuedRealtimeRefresh = false;
        await _refreshOfficeUpdatesFromRealtime();
      }
    });

    return completer.future;
  }

  Future<void> _refreshUnreadCountFromServerOrLocal() async {
    try {
      _unreadCount = await _notificationService.fetchUnreadCount();
    } catch (_) {
      _recalculateUnreadCount();
    }
  }

  void _queueUnreadCountRealtimeReconcile() {
    _unreadCountRealtimeDebounce?.cancel();

    _unreadCountRealtimeDebounce = Timer(
      _unreadCountRealtimeCoalesceWindow,
      () async {
        _unreadCountRealtimeDebounce = null;

        if (!_isInitialized) return;

        await _refreshUnreadCountFromServerOrLocal();
        notifyListeners();
      },
    );
  }

  Future<void> _refreshPublishedAnnouncements() async {
    try {
      final announcements = await _announcementService.fetchAnnouncements();
      _announcementNotifications = announcements
          .map((announcement) => announcement.toNotification())
          .toList(growable: false);
    } catch (error) {
      // Notifications must continue loading even if the announcements endpoint
      // is temporarily unavailable. Keep the last successfully loaded set.
      debugPrint('ANNOUNCEMENT NOTIFICATION FALLBACK REFRESH ERROR: $error');
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

      if (notification.notificationId.trim().isEmpty) {
        unawaited(_refreshOfficeUpdatesFromRealtime());
        return;
      }

      if (_isScholarApprovalNotification(notification)) {
        await _applyScholarAccess(true);
      }

      _bumpModuleRevisionsFromNotification(notification);

      _notifications = <AppNotification>[
        notification,
        ..._notifications.where(
          (item) => item.notificationId != notification.notificationId,
        ),
      ];
      _notificationMutationRevision += 1;

      // Display the new notification immediately from the socket payload.
      // Reconcile the server count in the background instead of blocking UI.
      _recalculateUnreadCount();
      notifyListeners();

      _queueUnreadCountRealtimeReconcile();
    } catch (error) {
      debugPrint('UPSERT REALTIME NOTIFICATION ERROR: $error');
    }
  }

  void _bumpModuleRevisionsFromNotification(AppNotification notification) {
    final type = notification.normalizedType;
    final title = notification.normalizedTitle;
    final message = notification.normalizedMessage;
    final referenceType = notification.normalizedReferenceType;
    final searchable = '$type $title $message $referenceType';

    if (notification.isAnnouncementNotification) {
      _announcementRevision += 1;
    }

    if (notification.isOpeningUpdate ||
        searchable.contains('opening') ||
        searchable.contains('program_opening')) {
      _openingRevision += 1;
    }

    if (notification.isApplicationNotification ||
        notification.isDocumentNotification ||
        searchable.contains('endorsement') ||
        searchable.contains('ocr')) {
      _applicationRevision += 1;
    }

    if (searchable.contains('renewal')) {
      _renewalRevision += 1;
    }

    if (notification.isPayoutNotification) {
      _payoutRevision += 1;
    }

    if (notification.isRoNotification) {
      _roRevision += 1;
    }

    if (searchable.contains('profile') ||
        searchable.contains('profile_photo') ||
        searchable.contains('account')) {
      _profileRevision += 1;
    }

    if (searchable.contains('scholar') ||
        searchable.contains('scholarship status')) {
      _scholarRevision += 1;
      _profileRevision += 1;
    }
  }

  Future<void> _updateNotificationFromEvent(MobileRealtimeEvent event) async {
    final payload = event.payload;
    if (payload.isEmpty) return;

    try {
      final updated = AppNotification.fromJson(payload);

      if (updated.notificationId.trim().isEmpty) {
        _queueUnreadCountRealtimeReconcile();
        return;
      }

      _bumpModuleRevisionsFromNotification(updated);

      var found = false;

      _notifications = _notifications
          .map((notification) {
            if (notification.notificationId == updated.notificationId) {
              found = true;
              return updated;
            }

            return notification;
          })
          .toList(growable: false);

      if (!found) {
        _notifications = <AppNotification>[updated, ..._notifications];
      }

      _notificationMutationRevision += 1;
      _recalculateUnreadCount();

      // Do not await another API call before rebuilding the visible screen.
      notifyListeners();
      _queueUnreadCountRealtimeReconcile();
    } catch (error) {
      debugPrint('UPDATE REALTIME NOTIFICATION ERROR: $error');
    }
  }

  Future<void> _removeNotificationFromEvent(MobileRealtimeEvent event) async {
    final notificationId =
        event.payload['notificationId']?.toString() ??
        event.payload['notification_id']?.toString() ??
        event.referenceId;

    if (notificationId.trim().isEmpty) return;

    _notifications = _notifications
        .where((notification) => notification.notificationId != notificationId)
        .toList(growable: false);

    _notificationMutationRevision += 1;
    _recalculateUnreadCount();

    // Remove from the visible list immediately.
    notifyListeners();
    _queueUnreadCountRealtimeReconcile();
  }

  void _markLocalNotificationsRead() {
    _notifications = _notifications
        .map((item) => item.copyWith(isRead: true))
        .toList(growable: false);

    _notificationMutationRevision += 1;
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

    bool shouldKeep(AppNotification notification) {
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
    }

    // Remove the item from both the real notification cache and the
    // announcement fallback cache immediately. Without clearing the fallback,
    // an archived announcement could remain visible until the next API fetch.
    _notifications = _notifications.where(shouldKeep).toList(growable: false);
    _announcementNotifications = _announcementNotifications
        .where(shouldKeep)
        .toList(growable: false);

    if (_latestPendingOpeningUpdate != null &&
        !shouldKeep(_latestPendingOpeningUpdate!)) {
      _latestPendingOpeningUpdate = null;
    }

    _recalculateUnreadCount();
    notifyListeners();
  }

  Future<void> _queueScholarAccessRefresh() {
    if (_isScholarAccessRefreshing) {
      _hasQueuedScholarAccessRefresh = true;
      return _scholarAccessRefreshCompleter?.future ?? Future<void>.value();
    }

    _scholarAccessRefreshDebounce?.cancel();
    final completer = _scholarAccessRefreshCompleter ??= Completer<void>();

    _scholarAccessRefreshDebounce = Timer(
      _scholarAccessRefreshCoalesceWindow,
      () async {
        _scholarAccessRefreshDebounce = null;
        _isScholarAccessRefreshing = true;

        try {
          await _refreshScholarAccessFromProfile();
        } finally {
          _isScholarAccessRefreshing = false;

          final pending = _scholarAccessRefreshCompleter;
          _scholarAccessRefreshCompleter = null;

          if (pending != null && !pending.isCompleted) {
            pending.complete();
          }
        }

        if (_hasQueuedScholarAccessRefresh) {
          _hasQueuedScholarAccessRefresh = false;
          await _queueScholarAccessRefresh();
        }
      },
    );

    return completer.future;
  }

  Future<bool?> _refreshScholarAccessFromProfile() async {
    try {
      final profile = await _profileService.fetchMyProfile();
      final hasAccess = profile['has_scholar_access'] == true;
      await _applyScholarAccess(hasAccess);
      notifyListeners();
      return hasAccess;
    } catch (_) {
      // Keep cached scholar access when profile refresh fails.
      return null;
    }
  }

  Future<bool> reconcileScholarActivation() async {
    final access = await _refreshScholarAccessFromProfile();
    if (access == true) {
      await refresh(silent: true);
      return true;
    }
    return false;
  }

  Future<void> deferScholarActivationUntilNextRefresh() async {
    await _applyScholarAccess(false);
    notifyListeners();
  }

  Future<void> _applyScholarAccess(bool nextValue) async {
    if (_hasScholarAccess == nextValue) {
      await _sessionService.saveScholarAccess(hasScholarAccess: nextValue);
      return;
    }

    _hasScholarAccess = nextValue;
    _scholarAccessRevision += 1;

    // Publish the in-memory access transition before waiting for device
    // storage. Mounted navigation, gates, and dashboard widgets update in the
    // same event turn; persistence remains awaited for restart durability.
    notifyListeners();

    await _sessionService.saveScholarAccess(hasScholarAccess: nextValue);
  }

  bool _isTargetedScholarAccessGrant(MobileRealtimeEvent event) {
    if (event.name != MobileRealtimeEvents.applicationApproved) return false;

    final payload = event.payload;
    final granted =
        payload['scholar_access_granted'] == true ||
        payload['scholar_access_granted']?.toString().trim().toLowerCase() ==
            'true';
    if (!granted) return false;

    final targetUserId = (payload['target_user_id'] ?? payload['targetUserId'])
        ?.toString()
        .trim();
    return targetUserId != null &&
        targetUserId.isNotEmpty &&
        targetUserId == _initializedUserId;
  }

  bool _isScholarApprovalNotification(AppNotification notification) {
    final normalizedType = notification.type.toLowerCase();
    final normalizedTitle = notification.title.toLowerCase();
    final normalizedReference = (notification.referenceType ?? '')
        .toLowerCase();

    final isLegacyScholarApproval =
        normalizedReference == 'scholar' &&
        (normalizedType == 'scholar approved' ||
            normalizedTitle == 'scholarship approved');

    // Final activation is emitted by the admin backend as an Application
    // notification. Recognize that canonical payload immediately so the
    // mounted mobile shell unlocks scholar routes without requiring a restart,
    // logout/login cycle, or a later profile refresh.
    final isApplicationActivation =
        normalizedReference == 'application' &&
        normalizedType == 'application' &&
        normalizedTitle == 'scholarship application approved';

    return isLegacyScholarApproval || isApplicationActivation;
  }

  void _recalculateUnreadCount() {
    _unreadCount = _notifications.where((item) => !item.isRead).length;
  }

  List<AppNotification> _composeNotifications() {
    final liveAnnouncementReferenceIds = _notifications
        .where((item) => item.isAnnouncementNotification)
        .map((item) => (item.referenceId ?? '').trim())
        .where((id) => id.isNotEmpty)
        .toSet();

    final liveNotificationIds = _notifications
        .map((item) => item.notificationId.trim())
        .where((id) => id.isNotEmpty)
        .toSet();

    final fallbackAnnouncements = _announcementNotifications.where((item) {
      final referenceId = (item.referenceId ?? '').trim();
      final notificationId = item.notificationId.trim();

      if (referenceId.isNotEmpty &&
          liveAnnouncementReferenceIds.contains(referenceId)) {
        return false;
      }

      if (notificationId.isNotEmpty &&
          liveNotificationIds.contains(notificationId)) {
        return false;
      }

      return true;
    });

    final combined = <AppNotification>[
      ..._notifications,
      ...fallbackAnnouncements,
    ]..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    return combined;
  }

  List<AppNotification> _composeOfficeUpdates() {
    final officeUpdates = _composeNotifications()
        .where((item) => item.isOfficeUpdate)
        .toList(growable: false);

    if (_latestPendingOpeningUpdate == null) {
      return officeUpdates;
    }

    final latestReferenceId = _latestPendingOpeningUpdate!.referenceId;

    final deduped = officeUpdates
        .where((item) {
          if (!item.isOpeningUpdate) {
            return true;
          }

          if (latestReferenceId == null || latestReferenceId.isEmpty) {
            return true;
          }

          return item.referenceId != latestReferenceId;
        })
        .toList(growable: false);

    final updates = <AppNotification>[_latestPendingOpeningUpdate!, ...deduped]
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    return updates;
  }

  void _resetRuntimeState({bool notify = true}) {
    _stopRealtimeListener?.call();
    _stopRealtimeListener = null;
    _realtimeSafetyTimer?.cancel();
    _realtimeSafetyTimer = null;

    _notifications = <AppNotification>[];
    _announcementNotifications = <AppNotification>[];
    _latestPendingOpeningUpdate = null;

    _isLoading = false;
    _isInitialized = false;
    _hasScholarAccess = false;
    _isRealtimeBridgeHealthy = false;
    _isRealtimeRefreshing = false;
    _hasQueuedRealtimeRefresh = false;

    _scholarAccessRefreshDebounce?.cancel();
    _scholarAccessRefreshDebounce = null;

    final pendingScholarAccessRefresh = _scholarAccessRefreshCompleter;
    _scholarAccessRefreshCompleter = null;

    if (pendingScholarAccessRefresh != null &&
        !pendingScholarAccessRefresh.isCompleted) {
      pendingScholarAccessRefresh.complete();
    }

    _isScholarAccessRefreshing = false;
    _hasQueuedScholarAccessRefresh = false;

    _errorMessage = null;
    _initializedUserId = '';

    _unreadCount = 0;
    _scholarAccessRevision = 0;
    _scholarActivationRevision = 0;
    _applicationRevision = 0;
    _announcementRevision = 0;
    _openingRevision = 0;
    _payoutRevision = 0;
    _renewalRevision = 0;
    _scholarRevision = 0;
    _ticketRevision = 0;
    _roRevision = 0;
    _settingsRevision = 0;
    _profileRevision = 0;

    if (notify) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _realtimeSafetyTimer?.cancel();
    _realtimeSafetyTimer = null;
    _unreadCountRealtimeDebounce?.cancel();
    _unreadCountRealtimeDebounce = null;
    _realtimeRefreshDebounce?.cancel();
    _realtimeRefreshDebounce = null;
    final realtimeCompleter = _realtimeRefreshCompleter;
    _realtimeRefreshCompleter = null;
    if (realtimeCompleter != null && !realtimeCompleter.isCompleted) {
      realtimeCompleter.complete();
    }

    _stopRealtimeListener?.call();
    _stopRealtimeListener = null;
    super.dispose();
  }
}
