import 'package:flutter/foundation.dart';

class AppConfig {
  AppConfig._();

  // Release = deployed backend
  static const String _defaultReleaseBaseUrl =
      'https://smart-pdm-3tbv.onrender.com';

  // Debug = local backend for Flutter Web development
  static const String _defaultDebugBaseUrl = 'http://192.168.100.9:5000/';

  static String get apiBaseUrl {
    const configuredValue = String.fromEnvironment('API_BASE_URL');
    final normalizedValue = configuredValue.trim();

    final selectedValue = normalizedValue.isEmpty
        ? (kReleaseMode ? _defaultReleaseBaseUrl : _defaultDebugBaseUrl)
        : normalizedValue;

    return selectedValue.endsWith('/')
        ? selectedValue.substring(0, selectedValue.length - 1)
        : selectedValue;
  }

  static const String _recaptchaAndroidSiteKey = String.fromEnvironment(
    'RECAPTCHA_ANDROID_SITE_KEY',
  );

  static String get recaptchaAndroidSiteKey => _recaptchaAndroidSiteKey.trim();
}
