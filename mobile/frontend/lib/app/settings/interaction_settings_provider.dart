import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class InteractionSettingsProvider extends ChangeNotifier {
  InteractionSettingsProvider._({
    required bool hapticsEnabled,
  }) : _hapticsEnabled = hapticsEnabled;

  static const String _hapticsKey =
      'smart_pdm_haptic_feedback_enabled';

  bool _hapticsEnabled;

  bool get hapticsEnabled => _hapticsEnabled;

  static Future<InteractionSettingsProvider> loadFromPreferences() async {
    final prefs = await SharedPreferences.getInstance();

    return InteractionSettingsProvider._(
      hapticsEnabled: prefs.getBool(_hapticsKey) ?? true,
    );
  }

  Future<void> setHapticsEnabled(bool value) async {
    if (_hapticsEnabled == value) return;

    _hapticsEnabled = value;
    notifyListeners();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_hapticsKey, value);
  }
}

class AppHaptics {
  AppHaptics._();

  static void selection(BuildContext context) {
    final settings = context.read<InteractionSettingsProvider>();
    if (!settings.hapticsEnabled) return;

    HapticFeedback.selectionClick();
  }

  static void lightImpact(BuildContext context) {
    final settings = context.read<InteractionSettingsProvider>();
    if (!settings.hapticsEnabled) return;

    HapticFeedback.lightImpact();
  }
}
