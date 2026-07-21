import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_typography.dart';

/// Applies Applicant Home's visual foundation without changing the app theme.
///
/// The app shell currently replaces the inherited text scaler. This scope reads
/// the real value from the active [FlutterView] and merges only that value into
/// the inherited [MediaQueryData]. Tests can inject equivalent platform data or
/// a scaler directly without introducing a production fallback constant.
class ApplicantHomeThemeScope extends StatelessWidget {
  const ApplicantHomeThemeScope({
    super.key,
    required this.child,
    this.platformMediaQueryData,
    this.platformTextScaler,
  });

  final Widget child;

  /// Optional seam for widget tests that need deterministic platform media.
  final MediaQueryData? platformMediaQueryData;

  /// Narrower optional seam when a test only needs to control text scaling.
  /// When supplied, this takes precedence over [platformMediaQueryData].
  final TextScaler? platformTextScaler;

  @override
  Widget build(BuildContext context) {
    final inheritedMediaQuery = MediaQuery.of(context);
    final resolvedTextScaler = _platformTextScaler(context);
    final scopedMediaQuery = inheritedMediaQuery.copyWith(
      textScaler: resolvedTextScaler,
    );
    final scopedTheme = _themeData(Theme.of(context));

    return MediaQuery(
      data: scopedMediaQuery,
      child: Theme(data: scopedTheme, child: child),
    );
  }

  TextScaler _platformTextScaler(BuildContext context) {
    final injectedTextScaler = platformTextScaler;
    if (injectedTextScaler != null) {
      return injectedTextScaler;
    }

    final injectedMediaQuery = platformMediaQueryData;
    if (injectedMediaQuery != null) {
      return injectedMediaQuery.textScaler;
    }

    return MediaQueryData.fromView(View.of(context)).textScaler;
  }

  ThemeData _themeData(ThemeData inherited) {
    final isDark = inherited.brightness == Brightness.dark;
    final background = isDark
        ? AppColors.applicantDarkBackground
        : AppColors.applicantLightBackground;
    final surface = isDark
        ? AppColors.applicantDarkSurface
        : AppColors.applicantLightSurface;
    final surfaceMuted = isDark
        ? AppColors.applicantDarkSurfaceMuted
        : AppColors.applicantLightSurfaceMuted;
    final outline = isDark
        ? AppColors.applicantDarkOutline
        : AppColors.applicantLightOutline;
    final text = isDark
        ? AppColors.applicantDarkText
        : AppColors.applicantLightText;
    final textMuted = isDark
        ? AppColors.applicantDarkTextMuted
        : AppColors.applicantLightTextMuted;
    final statusColors = isDark ? AppStatusColors.dark : AppStatusColors.light;
    final accessibleBrandForeground = isDark
        ? AppColors.yellow
        : AppColors.brown;
    final colorScheme = inherited.colorScheme.copyWith(
      primary: accessibleBrandForeground,
      onPrimary: isDark ? AppColors.darkBrown : AppColors.white,
      secondary: AppColors.gold,
      onSecondary: AppColors.darkBrown,
      surface: surface,
      onSurface: text,
      onSurfaceVariant: textMuted,
      surfaceContainerLowest: surface,
      surfaceContainerLow: surfaceMuted,
      surfaceContainer: surfaceMuted,
      outline: outline,
      outlineVariant: outline,
    );
    final textTheme = AppTypography.applicantHomeTextTheme(
      base: inherited.textTheme,
      textColor: text,
      mutedTextColor: textMuted,
    );
    final controlShape = RoundedRectangleBorder(borderRadius: AppRadii.control);
    final cardShape = RoundedRectangleBorder(
      borderRadius: AppRadii.card,
      side: BorderSide(color: outline),
    );
    const minimumControlSize = Size(
      AppSizes.minimumTapTarget,
      AppSizes.minimumTapTarget,
    );
    const controlPadding = EdgeInsets.symmetric(
      horizontal: AppSpacing.xl,
      vertical: AppSpacing.md,
    );

    return inherited.copyWith(
      colorScheme: colorScheme,
      scaffoldBackgroundColor: background,
      canvasColor: background,
      cardColor: surface,
      dividerColor: outline,
      hintColor: textMuted,
      textTheme: textTheme,
      primaryTextTheme: textTheme,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      extensions: <ThemeExtension<dynamic>>[
        for (final extension in inherited.extensions.values)
          if (extension is! AppStatusColors)
            // Flutter's self-referential ThemeExtension bound requires this
            // cast when extensions are copied from ThemeData's stored map.
            extension as ThemeExtension<ThemeExtension<dynamic>>,
        statusColors,
      ],
      cardTheme: CardThemeData(
        color: surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        shape: cardShape,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.gold,
          foregroundColor: AppColors.darkBrown,
          disabledBackgroundColor: outline,
          disabledForegroundColor: textMuted,
          minimumSize: minimumControlSize,
          padding: controlPadding,
          shape: controlShape,
          textStyle: textTheme.labelLarge,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.gold,
          foregroundColor: AppColors.darkBrown,
          disabledBackgroundColor: outline,
          disabledForegroundColor: textMuted,
          elevation: 0,
          minimumSize: minimumControlSize,
          padding: controlPadding,
          shape: controlShape,
          textStyle: textTheme.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: text,
          disabledForegroundColor: textMuted,
          minimumSize: minimumControlSize,
          padding: controlPadding,
          side: BorderSide(color: outline),
          shape: controlShape,
          textStyle: textTheme.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: isDark ? AppColors.yellow : AppColors.brown,
          minimumSize: minimumControlSize,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          shape: controlShape,
          textStyle: textTheme.labelLarge,
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          foregroundColor: text,
          minimumSize: minimumControlSize,
          tapTargetSize: MaterialTapTargetSize.padded,
        ),
      ),
      inputDecorationTheme: InputDecorationThemeData(
        filled: true,
        fillColor: surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        hintStyle: textTheme.bodyMedium?.copyWith(color: textMuted),
        labelStyle: textTheme.bodyMedium?.copyWith(color: textMuted),
        floatingLabelStyle: textTheme.bodyMedium?.copyWith(color: text),
        border: OutlineInputBorder(
          borderRadius: AppRadii.control,
          borderSide: BorderSide(color: outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadii.control,
          borderSide: BorderSide(color: outline),
        ),
        focusedBorder: const OutlineInputBorder(
          borderRadius: AppRadii.control,
          borderSide: BorderSide(color: AppColors.gold, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadii.control,
          borderSide: BorderSide(color: statusColors.dangerOutline),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadii.control,
          borderSide: BorderSide(color: statusColors.dangerOutline, width: 2),
        ),
      ),
      chipTheme: inherited.chipTheme.copyWith(
        backgroundColor: statusColors.neutralContainer,
        selectedColor: statusColors.inProgressContainer,
        disabledColor: surfaceMuted,
        side: BorderSide(color: statusColors.neutralOutline),
        shape: const RoundedRectangleBorder(borderRadius: AppRadii.status),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        labelStyle: textTheme.labelMedium?.copyWith(
          color: statusColors.onNeutralContainer,
        ),
        secondaryLabelStyle: textTheme.labelMedium?.copyWith(
          color: statusColors.onInProgressContainer,
        ),
      ),
      dividerTheme: DividerThemeData(color: outline, thickness: 1, space: 1),
      badgeTheme: BadgeThemeData(
        backgroundColor: AppColors.gold,
        textColor: AppColors.darkBrown,
        textStyle: textTheme.labelSmall?.copyWith(
          color: AppColors.darkBrown,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
