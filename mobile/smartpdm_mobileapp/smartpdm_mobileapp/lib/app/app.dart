import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/routes/app_router.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_theme.dart';
import 'package:smartpdm_mobileapp/app/theme/theme_provider.dart';

class SmartPdmApp extends StatelessWidget {
  const SmartPdmApp({super.key});

  double _smallScreenTextScale(double width) {
    if (width <= 360) return 1.14;
    if (width <= 400) return 1.08;
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
            final textScale = _smallScreenTextScale(mediaQuery.size.width);

            return MediaQuery(
              data: mediaQuery.copyWith(
                textScaler: TextScaler.linear(textScale),
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
