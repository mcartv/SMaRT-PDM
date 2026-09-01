abstract final class ApplicationFieldLimits {
  const ApplicationFieldLimits._();

  // Based on the current test-data distribution with safe headroom.
  static const int name = 50;
  static const int email = 64;
  static const int shortText = 100;
  static const int addressPart = 120;
  static const int longAddress = 250;
  static const int landline = 20;
  static const int section = 20;
  static const int schoolName = 150;
  static const int schoolAddress = 200;
  static const int honorsOrClub = 200;
  static const int otherSpecify = 150;
  static const int details = 500;
  static const int longExplanation = 1000;
  static const int essay = 2000;
  static const int lrnDigits = 12;
}
