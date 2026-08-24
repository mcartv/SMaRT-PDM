import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/application_form_preview_screen.dart';

void main() {
  test('submitted application form preview screen is constructible', () {
    const widget = ApplicationFormPreviewScreen();
    expect(widget, isA<Widget>());
  });
}
