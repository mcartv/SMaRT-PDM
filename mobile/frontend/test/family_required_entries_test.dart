import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_family_intake.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/widgets/intake_form_ui.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

void main() {
  for (final width in [375.0, 1024.0]) {
    testWidgets(
      'listed parent mobile persists across rebuilds at width $width',
      (tester) async {
        tester.view.physicalSize = Size(width, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final data = ApplicationData()
          ..fatherFirstName = 'Example'
          ..fatherLastName = 'Parent'
          ..fatherMiddleName = ''
          ..fatherMobile = '09170000001'
          ..fatherEducationalAttainment = 'College'
          ..fatherOccupation = 'Teacher'
          ..fatherCompanyNameAndAddress = 'School';
        Widget buildFamily() => MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: StepFamily(data: data, onChanged: () {}),
            ),
          ),
        );
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: StepFamily(data: data, onChanged: () {}),
              ),
            ),
          ),
        );
        expect(data.parentNativeStatus, isEmpty);
        expect(data.fatherMobile, '09170000001');
        final fatherMobile = find.byWidgetPredicate(
          (widget) =>
              widget is TextFormField &&
              widget.controller?.text == '09170000001',
        );
        await tester.ensureVisible(fatherMobile);
        await tester.tap(fatherMobile);
        await tester.enterText(fatherMobile, '09171111111');
        await tester.pump();
        expect(data.fatherMobile, '09171111111');

        await tester.pumpWidget(buildFamily());
        await tester.pump();
        expect(
          find.byWidgetPredicate(
            (widget) =>
                widget is TextFormField &&
                widget.controller?.text == '09171111111',
          ),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('listed parent mobile fields show required markers', (
    tester,
  ) async {
    final data = ApplicationData();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: StepFamily(data: data, onChanged: () {}, showErrors: true),
          ),
        ),
      ),
    );

    final fatherCard = find.ancestor(
      of: find.text("Father's Details"),
      matching: find.byType(IntakeCard),
    );
    final motherCard = find.ancestor(
      of: find.text("Mother's Details"),
      matching: find.byType(IntakeCard),
    );
    expect(
      find.descendant(of: fatherCard, matching: find.text('Mobile Number *')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: motherCard, matching: find.text('Mobile Number *')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: fatherCard, matching: find.text('Middle Name *')),
      findsNothing,
    );
    expect(
      find.descendant(of: motherCard, matching: find.text('Middle Name *')),
      findsNothing,
    );
  });
}
