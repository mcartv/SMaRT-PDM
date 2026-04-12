class AppConfig {
  AppConfig._();

  static const String _defaultBaseUrl = 'http://192.168.22.3:3000';

  static String get apiBaseUrl {
    const configuredValue = String.fromEnvironment('API_BASE_URL');
    if (configuredValue.isEmpty) {
      return _defaultBaseUrl;
    }

    return configuredValue.endsWith('/')
        ? configuredValue.substring(0, configuredValue.length - 1)
        : configuredValue;
  }

  // ✅ Define the missing variable
  static const String _recaptchaAndroidSiteKey =
      String.fromEnvironment('RECAPTCHA_ANDROID_SITE_KEY');

  static String get recaptchaAndroidSiteKey =>
      _recaptchaAndroidSiteKey.trim();
}