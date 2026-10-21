import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/shared/models/saved_application_print_model.dart';

void main() {
  test('scholarship-level selections are retained for PDF rendering', () {
    final model = SavedApplicationPrintModel.fromSavedFormData({
      'support': {
        'financial_support': 'Parents',
        'scholarship_history': true,
        'scholarship_elementary': true,
        'scholarship_high_school': true,
        'scholarship_college': false,
        'scholarship_others': true,
        'scholarship_others_specify': 'Private foundation',
        'scholarship_details': 'Previous scholarship details',
      },
    });

    expect(model.hadScholarship, true);
    expect(model.scholarshipElementary, true);
    expect(model.scholarshipHighSchool, true);
    expect(model.scholarshipCollege, false);
    expect(model.scholarshipOthers, true);
    expect(model.scholarshipOthersSpecify, 'Private foundation');
  });

  test('PDF template uses calibrated academic/support coordinates', () {
    final source = File(
      'lib/features/forms/data/services/scholarship_form_pdf_service.dart',
    ).readAsStringSync();

    expect(source, contains('final currentEnrollment = ['));
    expect(source, contains('r(80, 2230, 325, 55)'));
    expect(source, contains('r(420, 2230, 445, 55)'));
    expect(source, contains('r(890, 2230, 445, 55)'));

    expect(source, contains('model.supportParents'));
    expect(source, contains('model.supportScholarship'));
    expect(source, contains('model.supportLoan'));
    expect(source, contains('const Rect.fromLTWH(407.8, 532.54, 12.5, 9.15)'));
    expect(source, isNot(contains('drawCheck(model.supportOther')));

    expect(source, contains('model.scholarshipElementary'));
    expect(source, contains('model.scholarshipHighSchool'));
    expect(source, contains('model.scholarshipCollege'));
    expect(source, contains('model.scholarshipOthers'));

    expect(
      'III. ACADEMIC INFORMATION'.allMatches(source).length,
      1,
      reason:
          'The template renderer should have one coordinate source of truth.',
    );
  });

  test('file export reuses the byte renderer', () {
    final source = File(
      'lib/features/forms/data/services/scholarship_form_pdf_service.dart',
    ).readAsStringSync();

    final fileMethod = source.indexOf(
      'Future<File> generateFromSavedApplication(',
    );
    final openMethod = source.indexOf('Future<void> openGeneratedPdf(');

    expect(fileMethod, greaterThanOrEqualTo(0));
    expect(openMethod, greaterThan(fileMethod));

    final body = source.substring(fileMethod, openMethod);
    expect(body, contains('generateBytesFromSavedApplication(model)'));
    expect(body, isNot(contains('PdfDocument(')));
  });
}
