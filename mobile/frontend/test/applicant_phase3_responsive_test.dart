import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/success_screen.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/widgets/intake_form_ui.dart';

void main() {
  testWidgets('application success actions remain usable at 320px', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        onGenerateRoute: (settings) => MaterialPageRoute<void>(
          settings: const RouteSettings(
            name: '/success',
            arguments: {
              'applicationId': 'application-1',
              'openingId': 'opening-1',
              'openingTitle': 'Academic Scholarship',
              'programName': 'Scholarship Program',
            },
          ),
          builder: (_) => const SuccessScreen(),
        ),
        initialRoute: '/success',
      ),
    );
    await tester.pump();

    expect(find.text('Manage Required Documents'), findsOneWidget);
    expect(find.text('Track Application'), findsOneWidget);
    expect(find.text('Export Application Form'), findsOneWidget);
    expect(find.text('Back to Dashboard'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('review rows stack safely with larger text', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(320, 700),
            textScaler: TextScaler.linear(1.5),
          ),
          child: const Scaffold(
            body: SizedBox(
              width: 300,
              child: IntakeReviewRow(
                label: 'Permanent Address',
                value: 'A long applicant address that should remain readable',
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.text('Permanent Address'), findsOneWidget);
    expect(
      find.text('A long applicant address that should remain readable'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}
