import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Central typography scale for SMaRT PDM.
///
/// Use via [Theme.of(context).textTheme]:
/// - [TextTheme.displayLarge] — 32px, bold — page titles
/// - [TextTheme.headlineMedium] — 24px, bold — section headlines
/// - [TextTheme.titleLarge] — 20px, semi-bold — card/section titles
/// - [TextTheme.bodyLarge] — 16px, regular — prominent body, buttons
/// - [TextTheme.bodyMedium] — 14px, regular — standard body
/// - [TextTheme.labelMedium] — 12px, medium — captions, hints, labels
class AppTypography {
  AppTypography._();

  static TextTheme textTheme({required Color textColor}) {
    final base = GoogleFonts.interTextTheme();

    TextStyle role(
      TextStyle? style, {
      required double fontSize,
      required FontWeight fontWeight,
    }) {
      return (style ?? const TextStyle()).copyWith(
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: textColor,
        fontFamily: GoogleFonts.inter().fontFamily,
      );
    }

    return base.copyWith(
      displayLarge: role(
        base.displayLarge,
        fontSize: 32,
        fontWeight: FontWeight.w700,
      ),
      headlineMedium: role(
        base.headlineMedium,
        fontSize: 24,
        fontWeight: FontWeight.w700,
      ),
      titleLarge: role(
        base.titleLarge,
        fontSize: 20,
        fontWeight: FontWeight.w600,
      ),
      bodyLarge: role(
        base.bodyLarge,
        fontSize: 16,
        fontWeight: FontWeight.w400,
      ),
      bodyMedium: role(
        base.bodyMedium,
        fontSize: 14,
        fontWeight: FontWeight.w400,
      ),
      labelMedium: role(
        base.labelMedium,
        fontSize: 12,
        fontWeight: FontWeight.w500,
      ),
    );
  }

  /// Typography roles used only by the scoped Applicant Home theme.
  ///
  /// Copying the inherited styles preserves the application's configured font
  /// family while giving the redesigned subtree a complete, readable scale.
  /// Calling this method does not change the globally applied [textTheme].
  static TextTheme applicantHomeTextTheme({
    required TextTheme base,
    required Color textColor,
    required Color mutedTextColor,
  }) {
    TextStyle role(
      TextStyle? style, {
      required double fontSize,
      required FontWeight fontWeight,
      required Color color,
      required double height,
    }) {
      return (style ?? const TextStyle()).copyWith(
        color: color,
        fontSize: fontSize,
        fontWeight: fontWeight,
        height: height,
      );
    }

    return base.copyWith(
      displaySmall: role(
        base.displaySmall,
        fontSize: 28,
        fontWeight: FontWeight.w700,
        color: textColor,
        height: 1.15,
      ),
      headlineMedium: role(
        base.headlineMedium,
        fontSize: 24,
        fontWeight: FontWeight.w700,
        color: textColor,
        height: 1.2,
      ),
      headlineSmall: role(
        base.headlineSmall,
        fontSize: 22,
        fontWeight: FontWeight.w700,
        color: textColor,
        height: 1.2,
      ),
      titleLarge: role(
        base.titleLarge,
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: textColor,
        height: 1.25,
      ),
      titleMedium: role(
        base.titleMedium,
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: textColor,
        height: 1.3,
      ),
      titleSmall: role(
        base.titleSmall,
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: textColor,
        height: 1.35,
      ),
      bodyLarge: role(
        base.bodyLarge,
        fontSize: 16,
        fontWeight: FontWeight.w400,
        color: textColor,
        height: 1.5,
      ),
      bodyMedium: role(
        base.bodyMedium,
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: textColor,
        height: 1.45,
      ),
      bodySmall: role(
        base.bodySmall,
        fontSize: 13,
        fontWeight: FontWeight.w400,
        color: mutedTextColor,
        height: 1.4,
      ),
      labelLarge: role(
        base.labelLarge,
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: textColor,
        height: 1.25,
      ),
      labelMedium: role(
        base.labelMedium,
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: textColor,
        height: 1.3,
      ),
      labelSmall: role(
        base.labelSmall,
        fontSize: 11,
        fontWeight: FontWeight.w500,
        color: mutedTextColor,
        height: 1.3,
      ),
    );
  }
}
