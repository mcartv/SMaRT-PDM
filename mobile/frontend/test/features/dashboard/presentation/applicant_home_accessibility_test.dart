import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';

import '../../../support/applicant_home_test_harness.dart';

void main() {
  testWidgets(
    'announces headings, lifecycle step, row status, and update action',
    (tester) async {
      addTearDown(() => resetApplicantHomeTestView(tester));
      final semanticsHandle = tester.ensureSemantics();

      await pumpApplicantHome(tester, state: populatedApplicantHomeState());

      expect(
        find.bySemanticsLabel(
          RegExp(r'Upload your remaining documents\. Step 2 of 4\.'),
        ),
        findsOneWidget,
      );
      expect(
        find.bySemanticsLabel(
          RegExp(r'Requirements.*Documents needed.*3 documents remaining'),
        ),
        findsOneWidget,
      );
      expect(
        find.bySemanticsLabel(
          RegExp(r'OFFICE UPDATE\. Document review schedule updated\.'),
        ),
        findsOneWidget,
      );

      final welcomeSemantics = tester.getSemantics(
        find.text('Welcome, Teresa Tolentino'),
      );
      final progressSemantics = tester.getSemantics(
        find.text('Application progress'),
      );
      expect(
        welcomeSemantics.getSemanticsData().flagsCollection.isHeader,
        isTrue,
      );
      expect(
        progressSemantics.getSemanticsData().flagsCollection.isHeader,
        isTrue,
      );
      semanticsHandle.dispose();
    },
  );

  testWidgets('interactive controls are labelled and meet padded tap targets', (
    tester,
  ) async {
    addTearDown(() => resetApplicantHomeTestView(tester));
    final semanticsHandle = tester.ensureSemantics();

    await pumpApplicantHome(
      tester,
      state: populatedApplicantHomeState(),
      width: 390,
    );

    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));

    for (final element
        in find
            .byWidgetPredicate(
              (widget) => widget is ButtonStyleButton || widget is InkWell,
            )
            .evaluate()) {
      final renderObject = element.renderObject;
      if (renderObject is! RenderBox ||
          !renderObject.attached ||
          !renderObject.hasSize) {
        continue;
      }
      expect(
        renderObject.size.height,
        greaterThanOrEqualTo(48),
        reason: '${element.widget.runtimeType} is shorter than 48 pixels',
      );
      expect(
        renderObject.size.width,
        greaterThanOrEqualTo(48),
        reason: '${element.widget.runtimeType} is narrower than 48 pixels',
      );
    }
    semanticsHandle.dispose();
  });

  test('semantic foreground and container pairs meet WCAG AA contrast', () {
    for (final palette in const [AppStatusColors.light, AppStatusColors.dark]) {
      final pairs = <(Color, Color)>[
        (palette.onNeutralContainer, palette.neutralContainer),
        (palette.onInProgressContainer, palette.inProgressContainer),
        (palette.onActionRequiredContainer, palette.actionRequiredContainer),
        (palette.onSuccessContainer, palette.successContainer),
        (palette.onDangerContainer, palette.dangerContainer),
      ];

      for (final (foreground, background) in pairs) {
        expect(
          _contrastRatio(foreground, background),
          greaterThanOrEqualTo(4.5),
          reason:
              '${foreground.toARGB32().toRadixString(16)} on '
              '${background.toARGB32().toRadixString(16)}',
        );
      }
    }

    expect(
      _contrastRatio(AppColors.darkBrown, AppColors.gold),
      greaterThanOrEqualTo(4.5),
    );
  });
}

double _contrastRatio(Color first, Color second) {
  final lighter = math.max(first.computeLuminance(), second.computeLuminance());
  final darker = math.min(first.computeLuminance(), second.computeLuminance());
  return (lighter + .05) / (darker + .05);
}
