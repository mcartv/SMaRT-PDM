import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeProvider extends ChangeNotifier {
  static const _prefsKey = 'dark_mode_enabled';

  bool _isDarkMode = false;
  bool _isLoaded = false;

  bool get isDarkMode => _isDarkMode;
  bool get isLoaded => _isLoaded;
  ThemeMode get themeMode => _isDarkMode ? ThemeMode.dark : ThemeMode.light;

  ThemeProvider({bool? initialDarkMode}) {
    if (initialDarkMode != null) {
      _isDarkMode = initialDarkMode;
      _isLoaded = true;
      return;
    }

    _load();
  }

  static Future<ThemeProvider> loadFromPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    return ThemeProvider(
      initialDarkMode: prefs.getBool(_prefsKey) ?? false,
    );
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    _isDarkMode = prefs.getBool(_prefsKey) ?? false;
    _isLoaded = true;
    notifyListeners();
  }

  Future<void> setDarkMode(bool value) async {
    _isDarkMode = value;
    notifyListeners();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefsKey, value);
  }
}
