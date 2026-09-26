import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/routes/app_router.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_theme.dart';
import 'package:smartpdm_mobileapp/app/theme/theme_provider.dart';
import 'package:smartpdm_mobileapp/core/maintenance/maintenance_mode_gate.dart'; // SMART-PDM_MOBILE_MAINTENANCE_GATE_V1
import 'package:smartpdm_mobileapp/core/notifications/in_app_realtime_banner.dart';

final GlobalKey<NavigatorState> smartPdmNavigatorKey =
    GlobalKey<NavigatorState>();

class SmartPdmApp extends StatelessWidget {
  const SmartPdmApp({super.key});

  double _responsiveTextFactor(double width) {
    if (width <= 340) return 0.88;
    if (width <= 360) return 0.91;
    if (width <= 400) return 0.95;
    if (width <= 480) return 0.98;
    return 1.0;
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<ThemeProvider>(
      builder: (context, themeProvider, child) {
        return MaterialApp(
          navigatorKey: smartPdmNavigatorKey,
          title: 'SMaRT-PDM',
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: themeProvider.themeMode,
          themeAnimationDuration: const Duration(milliseconds: 240),
          themeAnimationCurve: Curves.easeOutCubic,
          initialRoute: AppRoutes.splash,
          onGenerateRoute: AppRouter.onGenerateRoute,
          builder: (context, child) {
            final mediaQuery = MediaQuery.of(context);
            final responsiveFactor = _responsiveTextFactor(
              mediaQuery.size.width,
            );

            final systemTextScale = mediaQuery.textScaler.scale(16) / 16;
            final effectiveTextScale = (systemTextScale * responsiveFactor)
                .clamp(0.85, 1.15)
                .toDouble();

            return MediaQuery(
              data: mediaQuery.copyWith(
                textScaler: TextScaler.linear(effectiveTextScale),
              ),
              child: InAppRealtimeBannerHost(
                navigatorKey: smartPdmNavigatorKey,
                child: MaintenanceModeGate(
                  child: child ?? const SizedBox.shrink(),
                ),
              ),
            );
          },
          debugShowCheckedModeBanner: false,
        );
      },
    );
  }
}
