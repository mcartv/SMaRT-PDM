import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/data/services/notification_service.dart';
import 'package:smartpdm_mobileapp/firebase_options.dart';

@pragma('vm:entry-point')
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

  Future<void> _initializeLocalNotifications() async {
    const initializationSettings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    );

    await _localNotifications.initialize(
      settings: initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        debugPrint(
          '[FCM] Local notification tapped: '
          '${response.payload}',
        );
      },
    );

    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();

    await androidPlugin?.createNotificationChannel(_channel);
  }

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
      payload: message.data['referenceId']?.toString(),
    );
  }

  void _handleNotificationTap(RemoteMessage message) {
    debugPrint(
      '[FCM] Notification opened: '
      'type=${message.data['referenceType']} '
      'reference=${message.data['referenceId']}',
    );

    // We'll connect this to SMaRT-PDM
    // navigation after basic push delivery
    // is confirmed working.
  }

  Future<void> dispose() async {
    await _tokenRefreshSubscription?.cancel();

    await _foregroundMessageSubscription?.cancel();

    await _messageOpenedSubscription?.cancel();

    _tokenRefreshSubscription = null;
    _foregroundMessageSubscription = null;
    _messageOpenedSubscription = null;
  }
}
