import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/application_form_preview_screen.dart';

void main() {
  test('application form preview compiles', () {
    expect(const ApplicationFormPreviewScreen(), isA<Widget>());
  });

  test('Edit Form follows backend lifecycle permission and keeps correction context', () {
    final source = File(
      'lib/features/applicant/presentation/screens/application_form_preview_screen.dart',
    ).readAsStringSync();

    expect(source, contains('final canEdit = _data != null && _canEdit;'));
    expect(source, contains('data == null || !_canEdit'));
    expect(source, contains("'Editing available'"));
    expect(source, contains("'Correction requested'"));
    expect(source, contains("'Editing locked'"));
    expect(
      source,
      isNot(
        contains('Edit Form will become available only if OSFA/Admin requests'),
      ),
    );
    expect(
      source,
      contains("_correctionRequested = editability['correction_requested'] == true"),
    );
    expect(source, contains("_optional(editability['correction_comment'])"));
    expect(source, contains('_editabilityMessage()'));
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
