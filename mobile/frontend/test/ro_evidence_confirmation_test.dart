import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  final source = File(
    'lib/features/scholar/presentation/screens/ro_assignment_screen.dart',
  ).readAsStringSync();

  test('time in prepares evidence before final confirmation and upload', () {
    final timeIn = source.substring(
      source.indexOf('Future<void> _timeIn'),
      source.indexOf('Future<void> _timeOut'),
    );
    expect(
      timeIn.indexOf('_buildProofFields'),
      lessThan(timeIn.indexOf('_confirmPreparedRoAction')),
    );
    expect(
      timeIn.indexOf('_confirmPreparedRoAction'),
      lessThan(timeIn.indexOf('_sendRoMultipart')),
    );
    expect(timeIn, contains('if (!confirmed) return;'));
  });

  test('time out prepares evidence before final confirmation and upload', () {
    final timeOut = source.substring(source.indexOf('Future<void> _timeOut'));
    expect(
      timeOut.indexOf('_buildProofFields'),
      lessThan(timeOut.indexOf('_confirmPreparedRoAction')),
    );
    expect(
      timeOut.indexOf('_confirmPreparedRoAction'),
      lessThan(timeOut.indexOf('_sendRoMultipart')),
    );
    expect(timeOut, contains('if (!confirmed) return;'));
  });
}
