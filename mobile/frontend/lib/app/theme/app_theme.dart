import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/motion/app_motion.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_typography.dart';

class AppTheme {
  static ThemeData light() {
    const background = AppColors.applicantLightBackground;
    const surface = AppColors.applicantLightSurface;
    const surfaceMuted = AppColors.applicantLightSurfaceMuted;
    const outline = AppColors.applicantLightOutline;
    const text = AppColors.applicantLightText;
    const mutedText = AppColors.applicantLightTextMuted;

    final colorScheme = ColorScheme.fromSeed(
      seedColor: AppColors.gold,
      brightness: Brightness.light,
    ).copyWith(
      primary: AppColors.gold,
      onPrimary: AppColors.darkBrown,
      secondary: AppColors.brown,
      onSecondary: AppColors.white,
      surface: surface,
      onSurface: text,
      onSurfaceVariant: mutedText,
      surfaceContainerLowest: background,
      surfaceContainerLow: surfaceMuted,
      surfaceContainer: surfaceMuted,
      surfaceContainerHigh: const Color(0xFFF1ECE5),
      outline: outline,
      outlineVariant: const Color(0xFFE9E1D7),
      error: const Color(0xFFB9363F),
      onError: AppColors.white,
      errorContainer: const Color(0xFFFDE9EA),
      onErrorContainer: const Color(0xFF821E25),
    );

    final textTheme = AppTypography.textTheme(textColor: text);
    final controlShape = RoundedRectangleBorder(borderRadius: AppRadii.control);

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: background,
      canvasColor: background,
      cardColor: surface,
      pageTransitionsTheme: AppMotion.pageTransitionsTheme,
      visualDensity: VisualDensity.adaptivePlatformDensity,
      textTheme: textTheme,
      primaryTextTheme: textTheme,
      extensions: const <ThemeExtension<dynamic>>[AppStatusColors.light],
      appBarTheme: const AppBarTheme(
        backgroundColor: surface,
        foregroundColor: AppColors.darkBrown,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: surface,
        selectedItemColor: AppColors.gold,
        unselectedItemColor: mutedText,
        selectedLabelStyle: TextStyle(fontWeight: FontWeight.w800),
        unselectedLabelStyle: TextStyle(fontWeight: FontWeight.w600),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        indicatorColor: AppColors.gold.withValues(alpha: 0.16),
        iconTheme: WidgetStateProperty.resolveWith((states) => IconThemeData(
          color: states.contains(WidgetState.selected)
              ? AppColors.darkBrown
              : mutedText,
        )),
        labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(
          color: states.contains(WidgetState.selected) ? text : mutedText,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w800
              : FontWeight.w600,
        )),
      ),
      cardTheme: CardThemeData(
        color: surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.card,
          side: const BorderSide(color: outline),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        labelStyle: const TextStyle(color: mutedText),
        hintStyle: const TextStyle(color: mutedText),
        helperStyle: const TextStyle(color: mutedText),
        border: OutlineInputBorder(
          borderRadius: AppRadii.control,
          borderSide: const BorderSide(color: outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadii.control,
          borderSide: const BorderSide(color: outline),
        ),
        focusedBorder: const OutlineInputBorder(
          borderRadius: AppRadii.control,
          borderSide: BorderSide(color: AppColors.gold, width: 1.5),
        ),
        errorBorder: const OutlineInputBorder(
          borderRadius: AppRadii.control,
          borderSide: BorderSide(color: Color(0xFFB9363F)),
        ),
        focusedErrorBorder: const OutlineInputBorder(
          borderRadius: AppRadii.control,
          borderSide: BorderSide(color: Color(0xFFB9363F), width: 1.5),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppStatusColors.light.neutralContainer,
        selectedColor: AppStatusColors.light.inProgressContainer,
        disabledColor: surfaceMuted,
        side: BorderSide(color: AppStatusColors.light.neutralOutline),
        shape: const RoundedRectangleBorder(borderRadius: AppRadii.status),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        labelStyle: textTheme.labelMedium?.copyWith(
          color: AppStatusColors.light.onNeutralContainer,
        ),
        secondaryLabelStyle: textTheme.labelMedium?.copyWith(
          color: AppStatusColors.light.onInProgressContainer,
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: AppRadii.card),
        titleTextStyle: textTheme.titleLarge?.copyWith(
          color: text,
          fontWeight: FontWeight.w800,
        ),
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: mutedText),
      ),
      listTileTheme: const ListTileThemeData(
        textColor: text,
        iconColor: mutedText,
      ),
      dividerTheme: const DividerThemeData(
        color: outline,
        thickness: 1,
        space: 1,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: surface,
        modalBackgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        dragHandleColor: mutedText,
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AppColors.darkBrown,
        contentTextStyle: TextStyle(color: AppColors.white),
        actionTextColor: AppColors.gold,
        closeIconColor: AppColors.white,
        behavior: SnackBarBehavior.floating,
      ),
      popupMenuTheme: const PopupMenuThemeData(
        color: surface,
        surfaceTintColor: Colors.transparent,
        textStyle: TextStyle(color: text),
        iconColor: mutedText,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.gold,
        linearTrackColor: surfaceMuted,
        circularTrackColor: surfaceMuted,
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: AppColors.gold,
        selectionColor: AppColors.gold.withValues(alpha: 0.24),
        selectionHandleColor: AppColors.gold,
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: text,
          disabledForegroundColor: mutedText.withValues(alpha: 0.55),
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.md,
          ),
          side: const BorderSide(color: outline),
          shape: controlShape,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.brown,
          minimumSize: const Size(48, 48),
          shape: controlShape,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.gold,
          foregroundColor: AppColors.darkBrown,
          disabledBackgroundColor: outline,
          disabledForegroundColor: mutedText,
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.xl,
            vertical: AppSpacing.md,
          ),
          shape: controlShape,
          textStyle: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.gold,
          foregroundColor: AppColors.darkBrown,
          disabledBackgroundColor: outline,
          disabledForegroundColor: mutedText,
          elevation: 0,
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.xl,
            vertical: AppSpacing.md,
          ),
          shape: controlShape,
          textStyle: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800),
        ),
      ),
    );
  }

  static ThemeData dark() {
    const darkBackground = AppColors.applicantDarkBackground;
    const darkSurface = AppColors.applicantDarkSurface;
    const darkSurfaceMuted = AppColors.applicantDarkSurfaceMuted;
    const darkTextColor = AppColors.applicantDarkText;
    const darkMutedTextColor = AppColors.applicantDarkTextMuted;
    const darkOutlineDefault = AppColors.applicantDarkOutline;
    const darkOutlineHover = Color(0xFF8A7A6C);
    const darkError = Color(0xFFFFB4AB);
    const darkErrorContainer = Color(0xFF7A2929);

    final colorScheme = ColorScheme.fromSeed(
      seedColor: AppColors.gold,
      brightness: Brightness.dark,
    ).copyWith(
      primary: AppColors.gold,
      onPrimary: AppColors.darkBrown,
      primaryContainer: const Color(0xFF624A00),
      onPrimaryContainer: const Color(0xFFFFE8A3),
      secondary: AppColors.lightBlue,
      onSecondary: const Color(0xFF00201F),
      secondaryContainer: const Color(0xFF164B49),
      onSecondaryContainer: const Color(0xFFB9F1EF),
      tertiary: const Color(0xFFFFB77A),
      onTertiary: const Color(0xFF351000),
      surface: darkSurface,
      onSurface: darkTextColor,
      onSurfaceVariant: darkMutedTextColor,
      surfaceContainerLowest: darkBackground,
      surfaceContainerLow: const Color(0xFF251C16),
      surfaceContainer: darkSurface,
      surfaceContainerHigh: darkSurfaceMuted,
      surfaceContainerHighest: const Color(0xFF40352B),
      outline: darkOutlineDefault,
      outlineVariant: const Color(0xFF4D433A),
      error: darkError,
      onError: const Color(0xFF3B0908),
      errorContainer: darkErrorContainer,
      onErrorContainer: const Color(0xFFFFDAD6),
      inverseSurface: AppColors.applicantDarkText,
      onInverseSurface: AppColors.darkBrown,
      inversePrimary: AppColors.brown,
      shadow: Colors.black,
      scrim: Colors.black,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: darkBackground,
      canvasColor: darkBackground,
      cardColor: darkSurface,
      disabledColor: darkMutedTextColor.withValues(alpha: 0.42),
      appBarTheme: const AppBarTheme(
        backgroundColor: darkSurface,
        foregroundColor: darkTextColor,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: darkSurface,
        selectedItemColor: accentColor,
        unselectedItemColor: darkMutedTextColor,
        selectedLabelStyle: TextStyle(fontWeight: FontWeight.w800),
        unselectedLabelStyle: TextStyle(fontWeight: FontWeight.w600),
      ),
      dividerColor: Colors.white12,
      pageTransitionsTheme: AppMotion.pageTransitionsTheme,
      visualDensity: VisualDensity.adaptivePlatformDensity,
      textTheme: AppTypography.textTheme(textColor: darkTextColor),
      primaryTextTheme: AppTypography.textTheme(textColor: darkTextColor),
      extensions: const <ThemeExtension<dynamic>>[AppStatusColors.dark],
      iconTheme: const IconThemeData(color: darkTextColor),
      primaryIconTheme: const IconThemeData(color: darkTextColor),
      hintColor: darkMutedTextColor,
      cardTheme: CardThemeData(
        color: darkSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shadowColor: Colors.black.withValues(alpha: 0.32),
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.card,
          side: const BorderSide(color: darkOutlineDefault),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: Color(0xFF4D433A),
        thickness: 1,
        space: 1,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.applicantDarkSurfaceMuted,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        labelStyle: const TextStyle(color: AppColors.applicantDarkTextMuted),
        hintStyle: const TextStyle(color: AppColors.applicantDarkTextMuted),
        prefixIconColor: AppColors.applicantDarkTextMuted,
        suffixIconColor: AppColors.applicantDarkTextMuted,
        errorStyle: const TextStyle(color: darkError),
        helperStyle: const TextStyle(color: darkMutedTextColor),
        enabledBorder: OutlineInputBorder(
          borderSide: const BorderSide(color: AppColors.applicantDarkOutline),
          borderRadius: AppRadii.control,
        ),
        focusedBorder: OutlineInputBorder(
          borderSide: const BorderSide(color: AppColors.gold, width: 1.4),
          borderRadius: AppRadii.control,
        ),
        errorBorder: OutlineInputBorder(
          borderSide: const BorderSide(color: darkError),
          borderRadius: AppRadii.control,
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderSide: const BorderSide(color: darkError, width: 1.4),
          borderRadius: AppRadii.control,
        ),
      ),
      dialogTheme: const DialogThemeData(
        backgroundColor: AppColors.applicantDarkSurface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: AppRadii.card),
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
      iconButtonTheme: IconButtonThemeData(
        style: ButtonStyle(
          foregroundColor: const WidgetStatePropertyAll(darkTextColor),
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return AppColors.gold.withValues(alpha: 0.18);
            }
            if (states.contains(WidgetState.hovered) ||
                states.contains(WidgetState.focused)) {
              return AppColors.gold.withValues(alpha: 0.11);
            }
            return Colors.transparent;
          }),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: darkSurface,
        indicatorColor: AppColors.gold.withValues(alpha: 0.22),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          return IconThemeData(
            color: states.contains(WidgetState.selected)
                ? AppColors.gold
                : darkMutedTextColor,
          );
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          return TextStyle(
            color: states.contains(WidgetState.selected)
                ? darkTextColor
                : darkMutedTextColor,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w800
                : FontWeight.w600,
          );
        }),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: darkSurface,
        modalBackgroundColor: darkSurface,
        surfaceTintColor: Colors.transparent,
        dragHandleColor: darkMutedTextColor,
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: Color(0xFF40352B),
        contentTextStyle: TextStyle(color: darkTextColor),
        actionTextColor: AppColors.yellow,
        closeIconColor: darkTextColor,
        behavior: SnackBarBehavior.floating,
      ),
      popupMenuTheme: const PopupMenuThemeData(
        color: darkSurface,
        surfaceTintColor: Colors.transparent,
        textStyle: TextStyle(color: darkTextColor),
        iconColor: darkMutedTextColor,
      ),
      tooltipTheme: const TooltipThemeData(
        decoration: BoxDecoration(
          color: Color(0xFFFFE8A3),
          borderRadius: BorderRadius.all(Radius.circular(8)),
        ),
        textStyle: TextStyle(color: AppColors.darkBrown),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: darkSurfaceMuted,
        selectedColor: AppColors.gold.withValues(alpha: 0.24),
        disabledColor: darkSurfaceMuted.withValues(alpha: 0.55),
        side: const BorderSide(color: darkOutlineDefault),
        shape: const RoundedRectangleBorder(borderRadius: AppRadii.status),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        labelStyle: const TextStyle(color: darkTextColor),
        secondaryLabelStyle: const TextStyle(color: darkTextColor),
        iconTheme: const IconThemeData(color: darkMutedTextColor),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          return states.contains(WidgetState.selected)
              ? AppColors.gold
              : Colors.transparent;
        }),
        checkColor: const WidgetStatePropertyAll(AppColors.darkBrown),
        side: const BorderSide(color: darkOutlineDefault, width: 1.5),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          return states.contains(WidgetState.selected)
              ? AppColors.gold
              : darkMutedTextColor;
        }),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          return states.contains(WidgetState.selected)
              ? AppColors.darkBrown
              : darkMutedTextColor;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          return states.contains(WidgetState.selected)
              ? AppColors.gold
              : darkSurfaceMuted;
        }),
        trackOutlineColor: const WidgetStatePropertyAll(darkOutlineDefault),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.gold,
        linearTrackColor: darkSurfaceMuted,
        circularTrackColor: darkSurfaceMuted,
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: AppColors.gold,
        selectionColor: AppColors.gold.withValues(alpha: 0.30),
        selectionHandleColor: AppColors.gold,
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
          minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
          ),
          shape: const WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: AppRadii.control),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return darkMutedTextColor.withValues(alpha: 0.42);
            }
            return AppColors.yellow;
          }),
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
          minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
          shape: const WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: AppRadii.control),
          ),
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
          minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(
              horizontal: AppSpacing.xl,
              vertical: AppSpacing.md,
            ),
          ),
          shape: const WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: AppRadii.control),
          ),
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
          minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(
              horizontal: AppSpacing.xl,
              vertical: AppSpacing.md,
            ),
          ),
          shape: const WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: AppRadii.control),
          ),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.gold,
        foregroundColor: AppColors.darkBrown,
        focusColor: Color(0xFFFFD75C),
        hoverColor: Color(0xFFFFD75C),
      ),
      tabBarTheme: const TabBarThemeData(
        labelColor: AppColors.yellow,
        unselectedLabelColor: darkMutedTextColor,
        indicatorColor: AppColors.gold,
        dividerColor: Color(0xFF4D433A),
      ),
      badgeTheme: const BadgeThemeData(
        backgroundColor: AppColors.gold,
        textColor: AppColors.darkBrown,
      ),
    );
  }
}
