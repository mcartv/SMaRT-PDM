import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_typography.dart';

class AppTheme {
  static ThemeData light() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: primaryColor,
      primary: primaryColor,
      secondary: accentColor,
      brightness: Brightness.light,
    ).copyWith(
      surface: Colors.white,
      onSurface: textColor,
      onPrimary: Colors.white,
    );

    final baseTheme = ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      primarySwatch: MaterialColor(primaryColor.toARGB32(), <int, Color>{
        50: primaryColor.withValues(alpha: 0.1),
        100: primaryColor.withValues(alpha: 0.2),
        200: primaryColor.withValues(alpha: 0.3),
        300: primaryColor.withValues(alpha: 0.4),
        400: primaryColor.withValues(alpha: 0.5),
        500: primaryColor.withValues(alpha: 0.6),
        600: primaryColor.withValues(alpha: 0.7),
        700: primaryColor.withValues(alpha: 0.8),
        800: primaryColor.withValues(alpha: 0.9),
        900: primaryColor.withValues(alpha: 1.0),
      }),
      scaffoldBackgroundColor: backgroundColor,
      canvasColor: backgroundColor,
      cardColor: Colors.white,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: pdmDarkBrown,
        elevation: 0,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: accentColor,
      ),
      visualDensity: VisualDensity.adaptivePlatformDensity,
      textTheme: AppTypography.textTheme(textColor: textColor),
    );

    return baseTheme.copyWith(
      primaryTextTheme: AppTypography.textTheme(textColor: textColor),
      appBarTheme: baseTheme.appBarTheme.copyWith(foregroundColor: textColor),
    );
  }

  static ThemeData dark() {
    const darkTextColor = Colors.white;
    const darkMutedTextColor = Colors.white70;

    final colorScheme = ColorScheme.fromSeed(
      seedColor: primaryColor,
      primary: accentColor,
      secondary: accentColor,
      brightness: Brightness.dark,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: const Color(0xFF24180F),
      canvasColor: const Color(0xFF2D1E12),
      cardColor: const Color(0xFF332216),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF24180F),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Color(0xFF2D1E12),
        selectedItemColor: accentColor,
        unselectedItemColor: Colors.white70,
      ),
      dividerColor: Colors.white12,
      visualDensity: VisualDensity.adaptivePlatformDensity,
      textTheme: AppTypography.textTheme(textColor: darkTextColor),
      primaryTextTheme: AppTypography.textTheme(textColor: darkTextColor),
      hintColor: darkMutedTextColor,
    );
  }
}
