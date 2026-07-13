import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/applicant_home_test_harness.dart';

void main() {
  testWidgets('no application light golden', (tester) async {
    addTearDown(() => resetApplicantHomeTestView(tester));
    await pumpApplicantHome(
      tester,
      state: noApplicationApplicantHomeState(),
      width: 360,
    );

    await _expectGolden(tester, 'no_application_light_360.png');
  });

  testWidgets('requirements missing at 2x text golden', (tester) async {
    addTearDown(() => resetApplicantHomeTestView(tester));
    await pumpApplicantHome(
      tester,
      state: populatedApplicantHomeState(longContent: true),
      width: 320,
      platformTextScale: 2,
    );

    await _expectGolden(tester, 'requirements_missing_light_320_text_2.png');
  });

  testWidgets('under review light golden', (tester) async {
    addTearDown(() => resetApplicantHomeTestView(tester));
    await pumpApplicantHome(
      tester,
      state: underReviewApplicantHomeState(),
      width: 390,
    );

    await _expectGolden(tester, 'under_review_light_390.png');
  });

  testWidgets('activated light golden', (tester) async {
    addTearDown(() => resetApplicantHomeTestView(tester));
    await pumpApplicantHome(
      tester,
      state: activatedApplicantHomeState(),
      width: 412,
    );

    await _expectGolden(tester, 'activated_light_412.png');
  });

  testWidgets('partial section error dark golden', (tester) async {
    addTearDown(() => resetApplicantHomeTestView(tester));
    await pumpApplicantHome(
      tester,
      state: partialErrorApplicantHomeState(),
      width: 390,
      themeMode: ThemeMode.dark,
    );
    await tester.ensureVisible(find.text('Updates are unavailable'));
    await tester.pump();

    await _expectGolden(tester, 'partial_error_dark_390.png');
  });

  testWidgets('long content dark at 1.3x text golden', (tester) async {
    addTearDown(() => resetApplicantHomeTestView(tester));
    await pumpApplicantHome(
      tester,
      state: populatedApplicantHomeState(longContent: true),
      width: 360,
      platformTextScale: 1.3,
      themeMode: ThemeMode.dark,
    );

    await _expectGolden(tester, 'long_content_dark_360_text_1_3.png');
  });
}

Future<void> _expectGolden(WidgetTester tester, String fileName) {
  return expectLater(
    find.byKey(const ValueKey<String>('applicant-home-golden-boundary')),
    matchesGoldenFile('../../../goldens/applicant_home/$fileName'),
  );
}
