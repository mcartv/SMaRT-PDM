import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_signing.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

void main() {
  Future<SigningState> pumpSigningPage(
    WidgetTester tester, {
    required double width,
    double textScale = 1,
    Future<XFile?> Function(ImageSource source)? pickSignatureImage,
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
              pickSignatureImage: pickSignatureImage,
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

  testWidgets(
    'signature upload chooser exposes camera and gallery and dispatches the selection',
    (tester) async {
      ImageSource? selectedSource;
      await pumpSigningPage(
        tester,
        width: 360,
        pickSignatureImage: (source) async {
          selectedSource = source;
          return null;
        },
      );

      expect(find.text('Upload Signature'), findsNWidgets(2));
      await tester.tap(
        find.byKey(const ValueKey('student-signature-upload-button')),
      );
      await tester.pumpAndSettle();

      expect(find.text('Capture a signature image'), findsOneWidget);
      expect(find.text('Choose an existing signature image'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('signature-upload-camera')));
      await tester.pumpAndSettle();

      expect(selectedSource, ImageSource.camera);

      final guardianUpload = find.byKey(
        const ValueKey('guardian-signature-upload-button'),
      );
      await tester.ensureVisible(guardianUpload);
      await tester.tap(guardianUpload);
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('signature-upload-gallery')));
      await tester.pumpAndSettle();

      expect(selectedSource, ImageSource.gallery);
    },
  );

  testWidgets('cancelling signature upload preserves a drawn signature', (
    tester,
  ) async {
    final state = await pumpSigningPage(tester, width: 360);
    state.studentPad.begin(const Offset(20, 20));
    await tester.pump();

    await tester.tap(find.text('Upload Signature').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();

    expect(state.studentPad.isEmpty, isFalse);
  });
}
