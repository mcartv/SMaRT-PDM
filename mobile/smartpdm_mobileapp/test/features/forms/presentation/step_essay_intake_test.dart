import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_essay_intake.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

void main() {
  testWidgets('StepEssay accepts short non-blank essays', (tester) async {
    final data = ApplicationData()
      ..describeYourselfEssay = 'I am a student.'
      ..aimsAndAmbitionEssay = 'I want to serve my community.';

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: StepEssay(data: data, onChanged: () {}, showErrors: true),
          ),
        ),
      ),
    );

    expect(find.text('Describe yourself essay is required.'), findsNothing);
    expect(find.text('Aims and ambition essay is required.'), findsNothing);
  });

  testWidgets('StepEssay rejects blank and whitespace-only essays', (
    tester,
  ) async {
    final data = ApplicationData()
      ..describeYourselfEssay = '   '
      ..aimsAndAmbitionEssay = '';

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: StepEssay(data: data, onChanged: () {}, showErrors: true),
          ),
        ),
      ),
    );

    expect(find.text('Describe yourself essay is required.'), findsOneWidget);
    expect(find.text('Aims and ambition essay is required.'), findsOneWidget);
  });
}
