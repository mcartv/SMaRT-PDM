import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/widgets/focus_invalid_field.dart';

void main() {
  testWidgets('scrolls to and focuses the first invalid input', (tester) async {
    final scopeKey = GlobalKey();
    final scroll = ScrollController();
    final first = FocusNode();
    final second = FocusNode();
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          controller: scroll,
          child: Column(key: scopeKey, children: [
            const SizedBox(height: 900),
            TextFormField(
              focusNode: first,
              decoration: const InputDecoration(errorText: 'Required'),
            ),
            TextFormField(
              focusNode: second,
              decoration: const InputDecoration(errorText: 'Required'),
            ),
            const SizedBox(height: 900),
          ]),
        ),
      ),
    ));
    expect(focusFirstInvalidField(scopeKey.currentContext!), isTrue);
    await tester.pumpAndSettle();
    expect(first.hasFocus, isTrue);
    expect(second.hasFocus, isFalse);
    expect(scroll.offset, greaterThan(0));
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    first.dispose();
    second.dispose();
    scroll.dispose();
  });
}
