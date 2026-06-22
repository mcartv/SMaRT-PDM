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

    TextStyle role(TextStyle? style, {
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
      displayLarge: role(base.displayLarge, fontSize: 32, fontWeight: FontWeight.w700),
      headlineMedium: role(base.headlineMedium, fontSize: 24, fontWeight: FontWeight.w700),
      titleLarge: role(base.titleLarge, fontSize: 20, fontWeight: FontWeight.w600),
      bodyLarge: role(base.bodyLarge, fontSize: 16, fontWeight: FontWeight.w400),
      bodyMedium: role(base.bodyMedium, fontSize: 14, fontWeight: FontWeight.w400),
      labelMedium: role(base.labelMedium, fontSize: 12, fontWeight: FontWeight.w500),
    );
  }
}
