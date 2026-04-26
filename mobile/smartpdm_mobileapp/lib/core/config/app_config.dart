import 'package:flutter/foundation.dart';

class AppConfig {
  AppConfig._();

  static const String _defaultDebugBaseUrl = 'http://192.168.22.2:5000';
  static const String _defaultReleaseBaseUrl = 'https://smart-pdm-mipx.onrender.com';

  static String get apiBaseUrl {
    const configuredValue = String.fromEnvironment('API_BASE_URL');
    final normalizedValue = configuredValue.trim();

    if (normalizedValue.isEmpty) {
      return kReleaseMode ? _defaultReleaseBaseUrl : _defaultDebugBaseUrl;
    }

    return normalizedValue.endsWith('/')
        ? normalizedValue.substring(0, normalizedValue.length - 1)
        : normalizedValue;
  }

  // ✅ Define the missing variable
  static const String _recaptchaAndroidSiteKey = String.fromEnvironment(
    'RECAPTCHA_ANDROID_SITE_KEY',
  );

  static String get recaptchaAndroidSiteKey => _recaptchaAndroidSiteKey.trim();
}
