import 'package:flutter/foundation.dart';

class AppConfig {
  AppConfig._();

  // Release = deployed backend
  static const String _defaultReleaseBaseUrl =
      'https://smart-pdm-3tbv.onrender.com';

  // Debug = local backend for Flutter Web development
  static const String _defaultDebugBaseUrl = 'http://192.168.100.9:5000';

  static String get apiBaseUrl {
    const configuredValue = String.fromEnvironment('API_BASE_URL');
    final normalizedValue = configuredValue.trim();

    final fallbackValue = kReleaseMode
        ? _defaultReleaseBaseUrl
        : _defaultDebugBaseUrl;
    final selectedValue = normalizedValue.isEmpty
        ? fallbackValue
        : _shouldIgnoreConfiguredBaseUrl(normalizedValue)
        ? fallbackValue
        : normalizedValue;

    return selectedValue.endsWith('/')
        ? selectedValue.substring(0, selectedValue.length - 1)
        : selectedValue;
  }

  static bool _shouldIgnoreConfiguredBaseUrl(String baseUrl) {
    final uri = Uri.tryParse(baseUrl);
    if (uri == null) return false;

    final host = uri.host.toLowerCase();
    return host == 'localhost' ||
        host == '127.0.0.1' ||
        host == '0.0.0.0' ||
        host == '::1';
  }
}
