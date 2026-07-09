import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_family.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

void main() {
  testWidgets(
    'StepFamily normalizes legacy educational attainment values',
    (tester) async {
      final data = ApplicationData()
        ..fatherEducationalAttainment = 'Post Graduate'
        ..motherEducationalAttainment = 'College'
        ..guardianEducationalAttainment = 'Vocational';

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StepFamily(data: data, onChanged: () {}),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(data.fatherEducationalAttainment, 'Post-Graduate');
    },
  );
}
