// SMaRT-PDM: Notifications — push notification service (mobile frontend); supports mobile UI behavior.
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/app.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/data/services/notification_service.dart';
import 'package:smartpdm_mobileapp/firebase_options.dart';

@pragma('vm:entry-point')
// firebaseMessagingBackgroundHandler: handles firebase messaging background handler for the Notifications flow.
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  debugPrint('[FCM] Background message received: ${message.messageId}');
}

class PushNotificationService {
  PushNotificationService._();

  static final PushNotificationService instance = PushNotificationService._();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  final SessionService _sessionService = const SessionService();

  final NotificationService _notificationService = NotificationService();

  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'smart_pdm_notifications',
    'SMaRT-PDM Notifications',
    description: 'Scholarship and account updates from SMaRT-PDM.',
    importance: Importance.high,
  );

  StreamSubscription<String>? _tokenRefreshSubscription;

  StreamSubscription<RemoteMessage>? _foregroundMessageSubscription;

  StreamSubscription<RemoteMessage>? _messageOpenedSubscription;

  // initialize: handles initialize for the Notifications flow.
  Future<void> initialize() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) {
      return;
    }

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    await _initializeLocalNotifications();
    await _requestPermission();
    await _refreshDeviceToken();

    _tokenRefreshSubscription ??= _messaging.onTokenRefresh.listen(
      (token) async {
        await _saveAndRegisterToken(token);
      },
      onError: (Object error) {
        debugPrint('[FCM] Token refresh error: $error');
      },
    );

    _foregroundMessageSubscription ??= FirebaseMessaging.onMessage.listen(
      _handleForegroundMessage,
    );

    _messageOpenedSubscription ??= FirebaseMessaging.onMessageOpenedApp.listen(
      _handleNotificationTap,
    );

    final initialMessage = await _messaging.getInitialMessage();

    if (initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }
  }

  // _initializeLocalNotifications: handles initialize local notifications for the Notifications flow.
  Future<void> _initializeLocalNotifications() async {
    const initializationSettings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    );

    await _localNotifications.initialize(
      settings: initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        final payload = response.payload;
        if (payload == null || payload.isEmpty) return;
        try {
          final decoded = jsonDecode(payload);
          if (decoded is Map) {
            _openFromData(decoded.map((key, value) =>
                MapEntry(key.toString(), value.toString())));
          }
        } catch (error) {
          debugPrint('[FCM] Invalid notification payload: $error');
        }
      },
    );

    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();

    await androidPlugin?.createNotificationChannel(_channel);
  }

  // _requestPermission: handles request permission for the Notifications flow.
  Future<void> _requestPermission() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    debugPrint(
      '[FCM] Permission status: '
      '${settings.authorizationStatus}',
    );
  }

  // _refreshDeviceToken: handles refresh device token for the Notifications flow.
  Future<void> _refreshDeviceToken() async {
    try {
      final token = await _messaging.getToken();

      if (token == null || token.trim().isEmpty) {
        debugPrint('[FCM] No device token returned.');

        return;
      }

      debugPrint('[FCM] Device token: $token');

      await _saveAndRegisterToken(token);
    } catch (error) {
      debugPrint(
        '[FCM] Failed to obtain '
        'device token: $error',
      );
    }
  }

  // _saveAndRegisterToken: handles save and register token for the Notifications flow.
  Future<void> _saveAndRegisterToken(String token) async {
    final cleanToken = token.trim();

    if (cleanToken.isEmpty) {
      return;
    }

    await _sessionService.savePushDeviceToken(
      token: cleanToken,
      platform: 'android',
    );

    final session = await _sessionService.getCurrentUser();

    if (session.token.trim().isEmpty) {
      return;
    }

    try {
      await _notificationService.registerStoredDeviceToken();

      debugPrint(
        '[FCM] Device token registered '
        'with SMaRT-PDM backend.',
      );
    } catch (error) {
      debugPrint(
        '[FCM] Backend device-token '
        'registration deferred: $error',
      );
    }
  }

  // _handleForegroundMessage: handles handle foreground message for the Notifications flow.
  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    debugPrint(
      '[FCM] Foreground message: '
      '${message.messageId}',
    );

    if (MobileRealtimeService.instance.isConnected) {
      debugPrint(
        '[FCM] Foreground system notification suppressed because '
        'the realtime in-app banner is active.',
      );
      return;
    }

    final notification = message.notification;

    final title =
        notification?.title ?? message.data['title']?.toString() ?? 'SMaRT-PDM';

    final body =
        notification?.body ??
        message.data['message']?.toString() ??
        message.data['body']?.toString() ??
        '';

    if (body.trim().isEmpty) {
      return;
    }

    final notificationDetails = NotificationDetails(
      android: AndroidNotificationDetails(
        _channel.id,
        _channel.name,
        channelDescription: _channel.description,
        importance: Importance.high,
        priority: Priority.high,
        icon: '@mipmap/ic_launcher',
      ),
    );

    await _localNotifications.show(
      id:
          message.messageId?.hashCode ??
          DateTime.now().millisecondsSinceEpoch.remainder(2147483647),
      title: title,
      body: body,
      notificationDetails: notificationDetails,
      payload: jsonEncode(message.data),
    );
  }

  // SMARTPDM_NOTIFICATION_ROUTE_DEDUP_V1: both FCM system alerts and
  // foreground local alerts use the same reference-based destination.
  void _handleNotificationTap(RemoteMessage message) {
    _openFromData(message.data);
  }

  void _openFromData(Map<String, dynamic> data) {
    final kind = (data['referenceType'] ?? data['reference_type'] ?? '').toString().toLowerCase();
    final ref = (data['referenceId'] ?? data['reference_id'] ?? '').toString();
    final type = (data['type'] ?? '').toString().toLowerCase();
    String destination = AppRoutes.notifications;
    Map<String, dynamic>? args;
    if (kind == 'payout_batch' || kind == 'payout' || type.contains('payout')) {
      destination = AppRoutes.payouts;
    } else if (kind.contains('announcement')) {
      // SMARTPDM_ANNOUNCEMENT_CONTEXT_ROUTE_V1
      destination = AppRoutes.announcements;
      args = {'announcementId': ref};
    } else if (kind.contains('chat_room') || kind == 'room' || kind == 'group_message') {
      destination = AppRoutes.chatThread;
      args = {'roomId': ref};
    } else if (kind.contains('endorsement') || kind.contains('application')) {
      destination = AppRoutes.status;
    } else if (kind.contains('document')) {
      destination = AppRoutes.documents;
    } else if (kind.contains('renewal')) {
      destination = AppRoutes.renewalDocuments;
    } else if (kind.contains('opening')) {
      destination = AppRoutes.scholarshipOpenings;
    } else if (kind.contains('profile') || kind.contains('account')) {
      destination = AppRoutes.profile;
    }
    // Wait until MaterialApp has installed its navigator (cold app startup).
    void navigate(int tries) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final nav = smartPdmNavigatorKey.currentState;
        if (nav != null) {
          nav.pushNamed(destination, arguments: args);
        } else if (tries < 20) {
          navigate(tries + 1);
        }
      });
    }
    navigate(0);
  }

  // dispose: handles dispose for the Notifications flow.
  Future<void> dispose() async {
    await _tokenRefreshSubscription?.cancel();

    await _foregroundMessageSubscription?.cancel();

    await _messageOpenedSubscription?.cancel();

    _tokenRefreshSubscription = null;
    _foregroundMessageSubscription = null;
    _messageOpenedSubscription = null;
  }
}
