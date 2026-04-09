class AppConfig {
  AppConfig._();

  static const String _defaultBaseUrl = 'http://192.168.22.6:3000';

  static String get apiBaseUrl {
    const configuredValue = String.fromEnvironment('API_BASE_URL');
    if (configuredValue.isEmpty) {
      return _defaultBaseUrl;
    }

    return configuredValue.endsWith('/')
        ? configuredValue.substring(0, configuredValue.length - 1)
        : configuredValue;
  }
}
