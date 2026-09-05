import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/new_applicant_screen.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/scholarship_openings_screen.dart';

void main() {
  test('cleaned mobile screens compile', () {
    expect(const ScholarshipOpeningsScreen(), isA<Widget>());
    expect(const NewApplicantScreen(), isA<Widget>());
  });

  test('opening rule chips are removed', () {
    final source = File(
      'lib/features/applicant/presentation/screens/scholarship_openings_screen.dart',
    ).readAsStringSync();

    expect(source, isNot(contains('_scholarshipRules(opening)')));
    expect(source, contains('_applicationPeriodLabel(opening)'));
    expect(source.toLowerCase(), isNot(contains('available slots')));
    expect(source.toLowerCase(), isNot(contains('remaining slots')));
  });

  test(
    'application form uses inline feedback instead of validation snackbars',
    () {
      final source = File(
        'lib/features/applicant/presentation/screens/new_applicant_screen.dart',
      ).readAsStringSync();

      expect(source, contains('String? _formFeedbackError;'));
      expect(
        source,
        isNot(
          contains('.showSnackBar(SnackBar(content: Text(validationError)))'),
        ),
      );
      expect(
        source,
        isNot(
          contains('.showSnackBar(SnackBar(content: Text(successMessage)))'),
        ),
      );
    },
  );
}
