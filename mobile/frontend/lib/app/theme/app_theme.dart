import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/motion/app_motion.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_typography.dart';

class AppTheme {
  static ThemeData light() {
    final colorScheme =
        ColorScheme.fromSeed(
          seedColor: primaryColor,
          primary: primaryColor,
          secondary: accentColor,
          brightness: Brightness.light,
        ).copyWith(
          surface: Colors.white,
          onSurface: textColor,
          onPrimary: Colors.white,
        );

    const outlineDefault = Color(0xFFD2D2D2);
    const outlineHover = Color(0xFFBEBEBE);

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
      pageTransitionsTheme: AppMotion.pageTransitionsTheme,
      visualDensity: VisualDensity.adaptivePlatformDensity,
      textTheme: AppTypography.textTheme(textColor: textColor),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return textColor.withValues(alpha: 0.38);
            }
            return textColor.withValues(alpha: 0.82);
          }),
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return const Color(0xFFEDEDED);
            }
            if (states.contains(WidgetState.hovered) ||
                states.contains(WidgetState.focused)) {
              return const Color(0xFFF5F5F5);
            }
            return Colors.transparent;
          }),
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          side: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return BorderSide(
                color: outlineDefault.withValues(alpha: 0.58),
                width: 1,
              );
            }
            return BorderSide(
              color: states.contains(WidgetState.hovered) ||
                      states.contains(WidgetState.focused)
                  ? outlineHover
                  : outlineDefault,
              width: 1,
            );
          }),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          overlayColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return primaryColor.withValues(alpha: 0.14);
            }
            if (states.contains(WidgetState.hovered) ||
                states.contains(WidgetState.focused)) {
              return primaryColor.withValues(alpha: 0.09);
            }
            return Colors.transparent;
          }),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return primaryColor.withValues(alpha: 0.40);
            }
            if (states.contains(WidgetState.pressed)) {
              return Color.alphaBlend(
                Colors.black.withValues(alpha: 0.13),
                primaryColor,
              );
            }
            if (states.contains(WidgetState.hovered) ||
                states.contains(WidgetState.focused)) {
              return Color.alphaBlend(
                Colors.black.withValues(alpha: 0.07),
                primaryColor,
              );
            }
            return primaryColor;
          }),
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return AppColors.darkBrown.withValues(alpha: 0.58);
            }
            return AppColors.darkBrown;
          }),
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return primaryColor.withValues(alpha: 0.40);
            }
            if (states.contains(WidgetState.pressed)) {
              return Color.alphaBlend(
                Colors.black.withValues(alpha: 0.13),
                primaryColor,
              );
            }
            if (states.contains(WidgetState.hovered) ||
                states.contains(WidgetState.focused)) {
              return Color.alphaBlend(
                Colors.black.withValues(alpha: 0.07),
                primaryColor,
              );
            }
            return primaryColor;
          }),
          foregroundColor: const WidgetStatePropertyAll(AppColors.darkBrown),
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
        ),
      ),
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

    const darkOutlineDefault = Color(0xFF665E57);
    const darkOutlineHover = Color(0xFF81766D);

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
      pageTransitionsTheme: AppMotion.pageTransitionsTheme,
      visualDensity: VisualDensity.adaptivePlatformDensity,
      textTheme: AppTypography.textTheme(textColor: darkTextColor),
      primaryTextTheme: AppTypography.textTheme(textColor: darkTextColor),
      hintColor: darkMutedTextColor,
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.applicantDarkSurfaceMuted,
        labelStyle: const TextStyle(color: AppColors.applicantDarkTextMuted),
        hintStyle: const TextStyle(color: AppColors.applicantDarkTextMuted),
        prefixIconColor: AppColors.applicantDarkTextMuted,
        suffixIconColor: AppColors.applicantDarkTextMuted,
        enabledBorder: OutlineInputBorder(
          borderSide: const BorderSide(color: AppColors.applicantDarkOutline),
          borderRadius: BorderRadius.circular(14),
        ),
        focusedBorder: OutlineInputBorder(
          borderSide: const BorderSide(color: AppColors.gold, width: 1.4),
          borderRadius: BorderRadius.circular(14),
        ),
      ),
      dialogTheme: const DialogThemeData(
        backgroundColor: AppColors.applicantDarkSurface,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          color: AppColors.applicantDarkText,
          fontSize: 20,
          fontWeight: FontWeight.w800,
        ),
        contentTextStyle: TextStyle(
          color: AppColors.applicantDarkTextMuted,
          fontSize: 14,
          height: 1.45,
        ),
      ),
      dropdownMenuTheme: const DropdownMenuThemeData(
        textStyle: TextStyle(color: AppColors.applicantDarkText),
        menuStyle: MenuStyle(
          backgroundColor: WidgetStatePropertyAll(
            AppColors.applicantDarkSurface,
          ),
          surfaceTintColor: WidgetStatePropertyAll(Colors.transparent),
        ),
      ),
      menuTheme: const MenuThemeData(
        style: MenuStyle(
          backgroundColor: WidgetStatePropertyAll(
            AppColors.applicantDarkSurface,
          ),
          surfaceTintColor: WidgetStatePropertyAll(Colors.transparent),
        ),
      ),
      listTileTheme: const ListTileThemeData(
        textColor: AppColors.applicantDarkText,
        iconColor: AppColors.applicantDarkTextMuted,
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return AppColors.applicantDarkTextMuted.withValues(alpha: 0.42);
            }
            return AppColors.applicantDarkText;
          }),
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return AppColors.applicantDarkSurfaceMuted.withValues(alpha: 0.95);
            }
            if (states.contains(WidgetState.hovered) ||
                states.contains(WidgetState.focused)) {
              return AppColors.applicantDarkSurfaceMuted.withValues(alpha: 0.72);
            }
            return Colors.transparent;
          }),
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          side: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return BorderSide(
                color: darkOutlineDefault.withValues(alpha: 0.55),
                width: 1,
              );
            }
            return BorderSide(
              color: states.contains(WidgetState.hovered) ||
                      states.contains(WidgetState.focused)
                  ? darkOutlineHover
                  : darkOutlineDefault,
              width: 1,
            );
          }),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          overlayColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return accentColor.withValues(alpha: 0.16);
            }
            if (states.contains(WidgetState.hovered) ||
                states.contains(WidgetState.focused)) {
              return accentColor.withValues(alpha: 0.11);
            }
            return Colors.transparent;
          }),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return accentColor.withValues(alpha: 0.34);
            }
            if (states.contains(WidgetState.pressed)) {
              return Color.alphaBlend(
                Colors.white.withValues(alpha: 0.13),
                accentColor,
              );
            }
            if (states.contains(WidgetState.hovered) ||
                states.contains(WidgetState.focused)) {
              return Color.alphaBlend(
                Colors.white.withValues(alpha: 0.07),
                accentColor,
              );
            }
            return accentColor;
          }),
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return AppColors.darkBrown.withValues(alpha: 0.60);
            }
            return AppColors.darkBrown;
          }),
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return accentColor.withValues(alpha: 0.34);
            }
            if (states.contains(WidgetState.pressed)) {
              return Color.alphaBlend(
                Colors.white.withValues(alpha: 0.13),
                accentColor,
              );
            }
            if (states.contains(WidgetState.hovered) ||
                states.contains(WidgetState.focused)) {
              return Color.alphaBlend(
                Colors.white.withValues(alpha: 0.07),
                accentColor,
              );
            }
            return accentColor;
          }),
          foregroundColor: const WidgetStatePropertyAll(AppColors.darkBrown),
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
        ),
      ),
    );
  }
}
