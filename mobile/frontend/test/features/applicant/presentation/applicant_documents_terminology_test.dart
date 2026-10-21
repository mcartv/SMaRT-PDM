import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('applicant documents uses the friendly signing section label only', () {
    final source = File(
      'lib/features/applicant/presentation/screens/applicant_documents_screen.dart',
    ).readAsStringSync();

    expect(source, contains('Applicant & Parent/Guardian Signatures'));
    expect(source, isNot(contains('Application Signing Evidence')));
    expect(source, contains('canReplaceSigningDocument'));
  });
}
