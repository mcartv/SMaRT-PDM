import 'package:flutter/foundation.dart';

class AppConfig {
  AppConfig._();

  /// Deployed student/mobile backend.
  ///
  /// The Flutter application should connect to this backend for:
  /// - Authentication
  /// - Applications
  /// - Documents
  /// - Notifications
  /// - Messaging REST requests
  /// - Socket.IO
  ///
  /// Communication with the admin backend is handled server-side.
  static const String _defaultApiBaseUrl =
      'https://smart-pdm-3tbv.onrender.com';

  /// Optional override:
  ///
  /// flutter run \
  ///   --dart-define=API_BASE_URL=https://example.com
  static const String _configuredApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
  );

  /// Optional separate Socket.IO override.
  ///
  /// Normally this should be the same origin as [apiBaseUrl].
  ///
  /// flutter run \
  ///   --dart-define=SOCKET_URL=https://example.com
  static const String _configuredSocketUrl = String.fromEnvironment(
    'SOCKET_URL',
  );

  static const String _recaptchaAndroidSiteKey = String.fromEnvironment(
    'RECAPTCHA_ANDROID_SITE_KEY',
  );

  static String get apiBaseUrl {
    return _normalizeUrl(
      _configuredApiBaseUrl.trim().isNotEmpty
          ? _configuredApiBaseUrl
          : _defaultApiBaseUrl,
    );
  }

  static String get socketBaseUrl {
    return _normalizeUrl(
      _configuredSocketUrl.trim().isNotEmpty
          ? _configuredSocketUrl
          : apiBaseUrl,
    );
  }

  static String get recaptchaAndroidSiteKey {
    return _recaptchaAndroidSiteKey.trim();
  }

  static bool get isReleaseMode => kReleaseMode;

  static bool get isDebugMode => kDebugMode;

  static String _normalizeUrl(String value) {
    var normalized = value.trim();

    while (normalized.endsWith('/')) {
      normalized = normalized.substring(0, normalized.length - 1);
    }

    return normalized;
  }
}
