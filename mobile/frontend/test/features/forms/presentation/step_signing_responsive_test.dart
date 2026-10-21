import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_signing.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

void main() {
  Future<SigningState> pumpSigningPage(
    WidgetTester tester, {
    required double width,
    double textScale = 1,
  }) async {
    await tester.binding.setSurfaceSize(Size(width, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final state = SigningState()
      ..error =
          'Complete both signatures, guardian details, ID, and consent first.';
    final data = ApplicationData()
      ..guardianFirstName = 'Alexandria'
      ..guardianMiddleName = 'Responsibility'
      ..guardianLastName = 'Montgomery-Smith';

    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        home: Scaffold(
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(12),
            child: StepSigning(
              data: data,
              state: state,
              showErrors: true,
              onChanged: () {},
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    return state;
  }

  for (final width in <double>[320, 360, 390]) {
    testWidgets(
      'Signing page has no horizontal overflow at ${width.toInt()}px',
      (tester) async {
        await pumpSigningPage(tester, width: width);

        expect(tester.takeException(), isNull);
        expect(
          find.bySemanticsLabel('Student signature signature canvas'),
          findsOne,
        );
        expect(
          find.bySemanticsLabel(
            'Parent or guardian signature signature canvas',
          ),
          findsOne,
        );
        expect(find.text('Camera'), findsOne);
        expect(find.text('Gallery'), findsOne);
        expect(find.byType(CheckboxListTile), findsOne);
        expect(find.text('Student signature is required.'), findsOne);
      },
    );
  }

  testWidgets('Signing page wraps long content at increased text scale', (
    tester,
  ) async {
    await pumpSigningPage(tester, width: 320, textScale: 1.4);

    expect(tester.takeException(), isNull);
    expect(find.text('Clear / Retry'), findsNWidgets(2));
    expect(find.text('Upload signing evidence'), findsOne);
  });

  testWidgets('Signing page remains usable at tablet width', (tester) async {
    await pumpSigningPage(tester, width: 768);

    expect(tester.takeException(), isNull);
    expect(
      find.bySemanticsLabel('Student signature signature canvas'),
      findsOne,
    );
    expect(
      find.bySemanticsLabel('Parent or guardian signature signature canvas'),
      findsOne,
    );
  });
}
