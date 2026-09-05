import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('SuccessScreen PDF export is Web-safe', () {
    final source = File(
      'lib/features/forms/presentation/screens/success_screen.dart',
    ).readAsStringSync();

    expect(source, isNot(contains("import 'dart:io';")));
    expect(source, isNot(contains('File? generatedFile')));
    expect(source, isNot(contains('XFile(generatedFile.path)')));
    expect(source, isNot(contains('generateFromApplicationId(applicationId)')));

    expect(
      source,
      contains(
        'generateBytesFromSubmissionPayload(submissionPayload ?? const {})',
      ),
    );
    expect(source, contains('generateBytesFromMySubmittedApplicationForm()'));
    expect(source, contains('XFile.fromData('));
    expect(source, contains("mimeType: 'application/pdf'"));
  });

  test('existing SuccessScreen fake tracks byte generation', () {
    final source = File(
      'test/printable_application_test.dart',
    ).readAsStringSync();

    expect(
      source,
      contains('Future<Uint8List> generateBytesFromSubmissionPayload('),
    );
    expect(source, contains('submissionPayload = payload;'));
  });
}
