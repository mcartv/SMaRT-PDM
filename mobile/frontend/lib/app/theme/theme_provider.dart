import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeProvider extends ChangeNotifier {
  static const _appearancePrefsKey = 'appearance_mode';
  static const _legacyDarkModePrefsKey = 'dark_mode_enabled';

  ThemeMode _themeMode = ThemeMode.light;
  bool _isLoaded = false;

  ThemeMode get themeMode => _themeMode;
  bool get isLoaded => _isLoaded;

  // Kept for compatibility with older widgets that still use this getter.
  bool get isDarkMode => _themeMode == ThemeMode.dark;

  String get appearanceLabel {
    return _themeMode == ThemeMode.dark ? 'Dark' : 'Light';
  }

  ThemeProvider({
    ThemeMode? initialThemeMode,
    bool? initialDarkMode,
  }) {
    if (initialThemeMode != null) {
      _themeMode = initialThemeMode == ThemeMode.dark
          ? ThemeMode.dark
          : ThemeMode.light;
      _isLoaded = true;
      return;
    }

    if (initialDarkMode != null) {
      _themeMode =
          initialDarkMode ? ThemeMode.dark : ThemeMode.light;
      _isLoaded = true;
      return;
    }

    _load();
  }

  static ThemeMode _parseMode(String? value) {
    return value == 'dark' ? ThemeMode.dark : ThemeMode.light;
  }

  static String _serializeMode(ThemeMode mode) {
    return mode == ThemeMode.dark ? 'dark' : 'light';
  }

  static Future<ThemeProvider> loadFromPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    final savedMode = prefs.getString(_appearancePrefsKey);

    if (savedMode != null) {
      return ThemeProvider(
        initialThemeMode: _parseMode(savedMode),
      );
    }

    // Preserve the user's previous Light/Dark preference after upgrading.
    final legacyDarkMode = prefs.getBool(_legacyDarkModePrefsKey);
    if (legacyDarkMode != null) {
      return ThemeProvider(
        initialThemeMode:
            legacyDarkMode ? ThemeMode.dark : ThemeMode.light,
      );
    }

    return ThemeProvider(initialThemeMode: ThemeMode.light);
  }

  Future<void> _load() async {
    final loaded = await loadFromPreferences();
    _themeMode = loaded.themeMode;
    _isLoaded = true;
    notifyListeners();
  }

  Future<void> setThemeMode(ThemeMode value) async {
    final normalized = value == ThemeMode.dark
        ? ThemeMode.dark
        : ThemeMode.light;
    if (_themeMode == normalized) return;

    _themeMode = normalized;
    notifyListeners();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _appearancePrefsKey,
      _serializeMode(normalized),
    );

    // Keep the old preference synchronized for older builds.
    await prefs.setBool(
      _legacyDarkModePrefsKey,
      normalized == ThemeMode.dark,
    );
  }

  // Compatibility path for older callers.
  Future<void> setDarkMode(bool value) {
    return setThemeMode(
      value ? ThemeMode.dark : ThemeMode.light,
    );
  }
}
