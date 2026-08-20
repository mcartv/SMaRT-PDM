import 'package:flutter/material.dart';

class AppColors {
  static const Color yellow = Color(0xFFFFE300);
  static const Color gold = Color(0xFFF5B80A);
  static const Color brown = Color(0xFF5C3000);
  static const Color darkBrown = Color(0xFF331A00);
  static const Color white = Color(0xFFFFFFFF);
  static const Color lightBlue = Color(0xFF6BC9C9);
  static const Color teal = Color(0xFF006354);
  static const Color orange = Color(0xFFC76917);
  static const Color magenta = Color(0xFFA80087);
  static const Color lightGray = Color(0xFFDAD9D6);
  static const Color black = Color(0xFF000000);

  // Applicant Home uses these additions through its scoped theme. Existing
  // application aliases remain unchanged so this slice cannot recolor legacy
  // screens unintentionally.
  static const Color applicantLightBackground = Color(0xFFF6F4F1);
  static const Color applicantLightSurface = Color(0xFFFFFFFF);
  static const Color applicantLightSurfaceMuted = Color(0xFFFAF4E8);
  static const Color applicantLightOutline = Color(0xFFE1D8CC);
  static const Color applicantLightText = Color(0xFF241A12);
  static const Color applicantLightTextMuted = Color(0xFF625A53);

  static const Color applicantDarkBackground = Color(0xFF1E1712);
  static const Color applicantDarkSurface = Color(0xFF2A211A);
  static const Color applicantDarkSurfaceMuted = Color(0xFF34291F);
  static const Color applicantDarkOutline = Color(0xFF65584D);
  static const Color applicantDarkText = Color(0xFFFFF8F1);
  static const Color applicantDarkTextMuted = Color(0xFFD5CBC2);
}

const Color pdmYellow = AppColors.yellow;
const Color pdmGold = AppColors.gold;
const Color pdmBrown = AppColors.brown;
const Color pdmDarkBrown = AppColors.darkBrown;
const Color pdmWhite = AppColors.white;
const Color pdmLightBlue = AppColors.lightBlue;
const Color pdmTeal = AppColors.teal;
const Color pdmOrange = AppColors.orange;
const Color pdmMagenta = AppColors.magenta;
const Color pdmLightGray = AppColors.lightGray;
const Color pdmBlack = AppColors.black;

const Color primaryColor = pdmGold;
const Color accentColor = pdmGold;
const Color backgroundColor = Color(0xFFF3F3F3);
const Color textColor = pdmBlack;
const Color mutedColor = pdmLightGray;

const double borderRadius = 8.0;
const double defaultPadding = 16.0;
const double padding = defaultPadding;
