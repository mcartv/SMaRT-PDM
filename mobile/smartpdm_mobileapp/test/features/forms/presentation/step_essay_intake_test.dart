import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_essay_intake.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

void main() {
  testWidgets('StepEssay shows the shared essay range error', (
    tester,
  ) async {
    final data = ApplicationData()
      ..describeYourselfEssay = _essayWords(199)
      ..aimsAndAmbitionEssay = _essayWords(200);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: StepEssay(
              data: data,
              onChanged: () {},
              showErrors: true,
            ),
          ),
        ),
      ),
    );

    expect(
      find.text('Describe yourself essay must be 200-300 words. Current count: 199.'),
      findsOneWidget,
    );
  });
}

String _essayWords(int count) {
  return List<String>.generate(count, (index) => 'word').join(' ');
}
