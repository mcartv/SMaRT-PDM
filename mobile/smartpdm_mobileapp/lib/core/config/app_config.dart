class AppConfig {
  AppConfig._();

  static const String _defaultBaseUrl = 'http://10.77.117.2:3000';

  static String get apiBaseUrl {
    const configuredValue = String.fromEnvironment('API_BASE_URL');
    if (configuredValue.isEmpty) {
      return _defaultBaseUrl;
    }

    return configuredValue.endsWith('/')
        ? configuredValue.substring(0, configuredValue.length - 1)
        : configuredValue;
  }

  static String get recaptchaAndroidSiteKey => _recaptchaAndroidSiteKey.trim();
}
