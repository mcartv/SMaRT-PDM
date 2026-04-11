import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/shell/presentation/screens/top_level_shell_screen.dart';
import 'package:smartpdm_mobileapp/features/scholar/data/services/scholar_access_service.dart';

class AppNavigator {
  static int? _topLevelIndexForRoute(String route) {
    switch (route) {
      case AppRoutes.home:
        return 0;
      case AppRoutes.payouts:
        return 1;
      case AppRoutes.notifications:
        return 2;
      case AppRoutes.profile:
        return 3;
      default:
        return null;
    }
  }

  static Future<void> goToTopLevel(
    BuildContext context,
    String route, {
    Object? arguments,
  }) {
    if (ScholarAccessService.isScholarOnlyRoute(route)) {
      return _guardScholarRoute(context, route, arguments: arguments);
    }

    final shellState = TopLevelShellScreen.maybeOf(context);
    final targetIndex = _topLevelIndexForRoute(route);

    if (shellState != null && targetIndex != null) {
      shellState.switchToIndex(targetIndex);
      return Future.value();
    }

    return Navigator.of(context).pushNamedAndRemoveUntil(
      route,
      (previousRoute) => false,
      arguments: arguments,
    );
  }

  static Future<void> pushDetail(BuildContext context, String route) {
    if (ScholarAccessService.isScholarOnlyRoute(route)) {
      return _guardScholarRoute(context, route);
    }

    return Navigator.of(context).pushNamed(route);
  }

  static Future<void> _guardScholarRoute(
    BuildContext context,
    String route, {
    Object? arguments,
  }) async {
    final hasAccess = await ScholarAccessService.ensureScholarAccess(context);
    if (!hasAccess || !context.mounted) return;

    final shellState = TopLevelShellScreen.maybeOf(context);
    final targetIndex = _topLevelIndexForRoute(route);

    if (shellState != null && targetIndex != null) {
      shellState.switchToIndex(targetIndex);
      return;
    }

    await Navigator.of(context).pushNamedAndRemoveUntil(
      route,
      (previousRoute) => false,
      arguments: arguments,
    );
  }

  static Future<void> goBackOrHome(BuildContext context) {
    final navigator = Navigator.of(context);
    if (navigator.canPop()) {
      navigator.pop();
      return Future.value();
    }

    return goToTopLevel(context, AppRoutes.home);
  }
}
