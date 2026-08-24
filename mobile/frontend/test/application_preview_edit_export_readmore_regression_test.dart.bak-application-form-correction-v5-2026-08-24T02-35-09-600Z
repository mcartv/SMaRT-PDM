import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/application_form_preview_screen.dart';

void main() {
  test('application preview compiles', () {
    expect(const ApplicationFormPreviewScreen(), isA<Widget>());
  });

  test('edit stays clickable and personal statements are expandable', () {
    final source = File(
      'lib/features/applicant/presentation/screens/application_form_preview_screen.dart',
    ).readAsStringSync();

    expect(source, contains('final canEdit = _data != null;'));
    expect(source, isNot(contains('data == null || !_canEdit')));
    expect(source, contains("'Read more'"));
    expect(source, contains("'Show less'"));
    expect(source, contains('maxLines: expanded ? null : 3'));
  });

  test('PDF export no longer calls the missing application-id route', () {
    final source = File(
      'lib/features/applicant/presentation/screens/application_form_preview_screen.dart',
    ).readAsStringSync();

    expect(source, contains('generateFromSubmissionPayload('));
    expect(source, contains('data.toSubmissionPayload()'));
    expect(
      source,
      isNot(
        contains('await _pdfService.generateFromApplicationId(applicationId)'),
      ),
    );
  });
}
