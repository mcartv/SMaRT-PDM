import 'package:flutter/material.dart';

/// Spacing scale for redesigned, locally scoped application surfaces.
abstract final class AppSpacing {
  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;
  static const double jumbo = 40;

  static const double screenHorizontal = lg;
  static const double section = xxl;
}

/// Corner-radius scale for redesigned, locally scoped application surfaces.
abstract final class AppRadii {
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double pill = 999;

  static const BorderRadius card = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius control = BorderRadius.all(Radius.circular(md));
  static const BorderRadius status = BorderRadius.all(Radius.circular(pill));
}

/// Geometry values that carry interaction or layout meaning.
abstract final class AppSizes {
  static const double minimumTapTarget = 48;
  static const double iconButton = minimumTapTarget;
  static const double cardIcon = 44;
  static const double maxContentWidth = 640;
  static const double applicantHomeBottomClearance = 112;
}
