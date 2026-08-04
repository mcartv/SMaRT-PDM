import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/routes/app_router.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_theme.dart';
import 'package:smartpdm_mobileapp/app/theme/theme_provider.dart';

class SmartPdmApp extends StatelessWidget {
  const SmartPdmApp({super.key});

  /// Slightly reduces typography on narrow phones so navigation labels,
  /// status cards, buttons, and form labels do not overflow.
  ///
  /// The previous implementation enlarged text by 8–14% on small screens,
  /// which caused otherwise valid one-line labels to wrap or clip.
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
          title: 'SMaRT-PDM',
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: themeProvider.themeMode,
          initialRoute: AppRoutes.splash,
          onGenerateRoute: AppRouter.onGenerateRoute,
          builder: (context, child) {
            final mediaQuery = MediaQuery.of(context);
            final responsiveFactor = _responsiveTextFactor(
              mediaQuery.size.width,
            );

            // Keep the user's accessibility preference, but apply a bounded
            // responsive adjustment so very narrow screens remain usable.
            final systemTextScale =
                mediaQuery.textScaler.scale(16) / 16;
            final effectiveTextScale = (systemTextScale * responsiveFactor)
                .clamp(0.85, 1.15)
                .toDouble();

            return MediaQuery(
              data: mediaQuery.copyWith(
                textScaler: TextScaler.linear(effectiveTextScale),
              ),
              child: child ?? const SizedBox.shrink(),
            );
          },
          debugShowCheckedModeBanner: false,
        );
      },
    );
  }
}
