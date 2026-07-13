import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:smartpdm_mobileapp/features/dashboard/presentation/widgets/applicant_home_view.dart';

import '../../../support/applicant_home_test_harness.dart';

void main() {
  const widths = <double>[320, 360, 390, 412];
  const textScales = <double>[1, 1.3, 2];
  const themeModes = <ThemeMode>[ThemeMode.light, ThemeMode.dark];

  for (final width in widths) {
    for (final textScale in textScales) {
      for (final themeMode in themeModes) {
        final themeLabel = themeMode == ThemeMode.dark ? 'dark' : 'light';

        testWidgets(
          '${width.toInt()}px at ${textScale}x in $themeLabel mode has no '
          'horizontal overflow',
          (tester) async {
            addTearDown(() => resetApplicantHomeTestView(tester));

            await pumpApplicantHome(
              tester,
              state: populatedApplicantHomeState(longContent: true),
              width: width,
              platformTextScale: textScale,
              themeMode: themeMode,
              parentTextScaler: const TextScaler.linear(.6),
            );

            final homeContext = tester.element(find.byType(ApplicantHomeView));
            expect(
              MediaQuery.textScalerOf(homeContext).scale(10),
              closeTo(10 * textScale, .001),
            );
            expect(tester.takeException(), isNull);
            _expectTextWithinViewport(tester, width);

            final bottomAction = find.text('Read latest update');
            await tester.scrollUntilVisible(bottomAction, 600);
            await tester.pump();

            expect(bottomAction, findsOneWidget);
            expect(find.text('Scholarship openings'), findsOneWidget);
            expect(tester.takeException(), isNull);
            _expectTextWithinViewport(tester, width);
          },
        );
      }
    }
  }
}

void _expectTextWithinViewport(WidgetTester tester, double width) {
  for (final element in find.byType(Text).evaluate()) {
    final renderObject = element.renderObject;
    if (renderObject is! RenderBox ||
        !renderObject.attached ||
        !renderObject.hasSize) {
      continue;
    }

    final rect = renderObject.localToGlobal(Offset.zero) & renderObject.size;
    expect(
      rect.left,
      greaterThanOrEqualTo(-.01),
      reason: 'Text escaped the left edge: ${_textValue(element)}',
    );
    expect(
      rect.right,
      lessThanOrEqualTo(width + .01),
      reason: 'Text escaped the right edge: ${_textValue(element)}',
    );
  }
}

String _textValue(Element element) {
  final widget = element.widget as Text;
  return widget.data ?? widget.textSpan?.toPlainText() ?? '<rich text>';
}
