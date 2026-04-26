import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';

class ScholarAccessService {
  static const String lockedMessage =
      'Scholar features are available only to approved scholars.';

  static final Set<String> scholarOnlyRoutes = {
    AppRoutes.payouts,
    AppRoutes.roAssignment,
    AppRoutes.roCompletion,
    AppRoutes.renewalDocuments,
  };

  static Future<bool> isVerifiedScholar() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('user_has_scholar_access') ?? false;
  }

  static bool isScholarOnlyRoute(String route) {
    if (route == AppRoutes.profile) return false;
    if (route == AppRoutes.home) return false;
    if (route == AppRoutes.notifications) return false;
    if (route == AppRoutes.faqs) return false;
    if (route == AppRoutes.tickets) return false;
    if (route == AppRoutes.scholarshipOpenings) return false;
    if (route == AppRoutes.documents) return false;
    if (route == AppRoutes.status) return false;

    return scholarOnlyRoutes.contains(route);
  }

  static Future<bool> ensureRouteAccess(
    BuildContext context,
    String route,
  ) async {
    if (!isScholarOnlyRoute(route)) return true;

    final hasAccess = await isVerifiedScholar();

    if (!hasAccess && context.mounted) {
      showLockedMessage(context);
    }

    return hasAccess;
  }

  // Backward-compatible method for old files still calling this.
  static Future<bool> ensureScholarAccess(BuildContext context) async {
    final hasAccess = await isVerifiedScholar();

    if (!hasAccess && context.mounted) {
      showLockedMessage(context);
    }

    return hasAccess;
  }

  static void showLockedMessage(BuildContext context) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;

    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(const SnackBar(content: Text(lockedMessage)));
  }
}
