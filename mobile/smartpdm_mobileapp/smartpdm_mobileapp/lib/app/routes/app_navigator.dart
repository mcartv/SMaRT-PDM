import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';

class AppNavigator {
  const AppNavigator._();

  /// Opens one of the root destinations used by the mobile shell.
  ///
  /// This clears old detail routes so the user returns to a clean root stack.
  static void goToTopLevel(BuildContext context, String route) {
    final targetRoute = AppRoutes.isTopLevel(route) ? route : AppRoutes.home;

    final currentRoute = ModalRoute.of(context)?.settings.name;

    if (currentRoute == targetRoute) {
      return;
    }

    Navigator.of(
      context,
    ).pushNamedAndRemoveUntil(targetRoute, (existingRoute) => false);
  }

  /// Opens a detail page without clearing the existing navigation stack.
  static Future<T?> pushDetail<T>(
    BuildContext context,
    String route, {
    Object? arguments,
  }) {
    return Navigator.of(context).pushNamed<T>(route, arguments: arguments);
  }

  /// Goes back when a previous page exists.
  /// Otherwise, it returns to the Dashboard.
  static void goBackOrHome(BuildContext context) {
    final navigator = Navigator.of(context);

    if (navigator.canPop()) {
      navigator.pop();
      return;
    }

    navigator.pushNamedAndRemoveUntil(AppRoutes.home, (existingRoute) => false);
  }
}
