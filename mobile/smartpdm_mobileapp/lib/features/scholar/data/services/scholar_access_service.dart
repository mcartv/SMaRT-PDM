import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';

class ScholarAccessService {
  static const String lockedMessage =
      'Scholar features are available only to verified scholars.';

  static const Set<String> scholarOnlyRoutes = {
    AppRoutes.payouts,
    AppRoutes.roAssignment,
    AppRoutes.roCompletion,
    AppRoutes.tickets,
  };

  static Future<bool> isVerifiedScholar() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('user_is_verified') ?? false;
  }

  static bool isScholarOnlyRoute(String route) {
    return scholarOnlyRoutes.contains(route);
  }

  static Future<bool> ensureScholarAccess(BuildContext context) async {
    final isVerified = await isVerifiedScholar();
    if (!isVerified && context.mounted) {
      showLockedMessage(context);
    }
    return isVerified;
  }

  static void showLockedMessage(BuildContext context) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;

    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(const SnackBar(content: Text(lockedMessage)));
  }
}
