import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/application_form_preview_screen.dart';

void main() {
  test('application form preview compiles', () {
    expect(const ApplicationFormPreviewScreen(), isA<Widget>());
  });

  test('Edit Form is controlled by backend correction permission', () {
    final source = File(
      'lib/features/applicant/presentation/screens/application_form_preview_screen.dart',
    ).readAsStringSync();

    expect(source, contains('final canEdit = _data != null && _canEdit;'));
    expect(source, contains('data == null || !_canEdit'));
    expect(source, contains("'Correction requested'"));
    expect(source, contains("'Editing locked'"));
    expect(
      source,
      contains('Edit Form will become available only if OSFA/Admin requests'),
    );
    expect(source, contains("_optional(editability['correction_comment'])"));
  });

  test('Personal Statement remains collapsible after three lines', () {
    final source = File(
      'lib/features/applicant/presentation/screens/application_form_preview_screen.dart',
    ).readAsStringSync();

    expect(source, contains("'Read more'"));
    expect(source, contains("'Show less'"));
    expect(source, contains('maxLines: expanded ? null : 3'));
  });

  test('Edge/Web PDF export remains in-memory', () {
    final preview = File(
      'lib/features/applicant/presentation/screens/application_form_preview_screen.dart',
    ).readAsStringSync();
    final printable = File(
      'lib/features/forms/data/services/printable_application_service.dart',
    ).readAsStringSync();
    final pdf = File(
      'lib/features/forms/data/services/scholarship_form_pdf_service.dart',
    ).readAsStringSync();

    expect(preview, contains('XFile.fromData('));
    expect(preview, contains("mimeType: 'application/pdf'"));
    expect(preview, contains('generateBytesFromSubmissionPayload('));
    expect(printable, contains('generateBytesFromSubmissionPayload('));
    expect(pdf, contains('generateBytesFromSavedApplication('));
  });
}
