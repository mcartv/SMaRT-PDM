import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_family_intake.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

void main() {
  for (final width in [375.0, 1024.0]) {
    testWidgets('guardian can use a listed parent at width $width', (tester) async {
      tester.view.physicalSize = Size(width, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final data = ApplicationData()
        ..fatherFirstName = 'Example'
        ..fatherLastName = 'Parent'
        ..fatherMiddleName = 'N/A'
        ..fatherMobile = 'N/A'
        ..fatherEducationalAttainment = 'College'
        ..fatherOccupation = 'Teacher'
        ..fatherCompanyNameAndAddress = 'School';
      await tester.pumpWidget(MaterialApp(home: Scaffold(body:
        SingleChildScrollView(child: StepFamily(data: data, onChanged: () {})))));
      expect(data.parentNativeStatus, isEmpty);
      expect(data.fatherMobile, 'N/A');
      final copyButton = find.text('Use Father as Guardian');
      await tester.ensureVisible(copyButton);
      await tester.pumpAndSettle();
      await tester.tap(copyButton);
      await tester.pumpAndSettle();
      expect(data.guardianFirstName, 'Example');
      expect(data.guardianLastName, 'Parent');
      expect(data.guardianMobile, 'N/A');
      expect(data.guardianEducationalAttainment, 'College');
      expect(tester.takeException(), isNull);
    });
  }
}
