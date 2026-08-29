import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';

class ScholarAccessService {
  // SMART-PDM_DISABLED_MODULE_FEEDBACK_V1
  static DateTime? _lastLockedMessageAt;
  static String? _lastLockedMessage;
  static const Duration _lockedMessageCooldown = Duration(milliseconds: 1200);

  static const String lockedMessage =
      'This module is unavailable until your scholarship is approved and activated.';

  static final Set<String> scholarOnlyRoutes = {
    AppRoutes.payouts,
    AppRoutes.roAssignment,
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
    if (route == AppRoutes.endorsement) return false;

    return scholarOnlyRoutes.contains(route);
  }

  static String moduleLabelForRoute(String? route) {
    switch (route) {
      case AppRoutes.payouts:
        return 'Payout';
      case AppRoutes.roAssignment:
        return 'Obligation';
      case AppRoutes.renewalDocuments:
        return 'Renewal';
      default:
        return 'This module';
    }
  }

  static String lockedMessageForRoute(String? route) {
    final label = moduleLabelForRoute(route);
    return '$label is unavailable until your scholarship is approved and activated.';
  }

  static Future<bool> ensureRouteAccess(
    BuildContext context,
    String route,
  ) async {
    if (!isScholarOnlyRoute(route)) return true;

    final hasAccess = await isVerifiedScholar();

    if (!hasAccess && context.mounted) {
      showLockedMessage(context, route: route);
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

  static void dismissLockedMessage(BuildContext context) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;

    messenger.clearSnackBars();
    messenger.removeCurrentSnackBar();
  }

  static void showLockedMessage(
    BuildContext context, {
    String? route,
  }) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;

    final message = lockedMessageForRoute(route);
    final now = DateTime.now();
    final lastShownAt = _lastLockedMessageAt;

    if (_lastLockedMessage == message &&
        lastShownAt != null &&
        now.difference(lastShownAt) < _lockedMessageCooldown) {
      return;
    }

    _lastLockedMessageAt = now;
    _lastLockedMessage = message;

    // Keep exactly one non-blocking explanation visible at a time.
    messenger.clearSnackBars();
    messenger.removeCurrentSnackBar();

    messenger.showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(
              Icons.lock_outline_rounded,
              size: 18,
              color: Colors.white,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        duration: const Duration(milliseconds: 2200),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        dismissDirection: DismissDirection.down,
      ),
    );
  }
}
