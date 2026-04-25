class AppConfig {
  AppConfig._();

  static const String _defaultBaseUrl = 'http://192.168.100.9:5000';

  static String get apiBaseUrl {
    const configuredValue = String.fromEnvironment('API_BASE_URL');
    final normalizedValue = configuredValue.trim();

    if (normalizedValue.isEmpty) {
      return _defaultBaseUrl;
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
