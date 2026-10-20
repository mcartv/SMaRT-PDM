import 'dart:typed_data';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_signing.dart';

void main() {
  group('SigningState', () {
    test('rejects empty signatures first', () {
      final state = SigningState();
      expect(state.validationMessage, 'Student signature is required.');
    });

    test('requires guardian ID and consent after signatures', () {
      final state = SigningState()
        ..studentSigned = true
        ..guardianSigned = true;
      expect(state.validationMessage, 'A parent or guardian ID is required.');
      state.guardianId = Uint8List.fromList(<int>[1]);
      expect(state.validationMessage, 'Consent acknowledgment is required.');
    });

    test('requires server-confirmed session before it is ready', () {
      final state = SigningState()
        ..studentSigned = true
        ..guardianSigned = true
        ..guardianId = Uint8List.fromList(<int>[1])
        ..consent = true;
      expect(
        state.validationMessage,
        'Upload the signing evidence before submitting.',
      );
      state.sessionId = 'session-1';
      expect(state.validationMessage, isNull);
    });

    test('successful upload state is submission-ready', () {
      final state = SigningState()
        ..sessionId = 'session-1'
        ..studentSigned = true
        ..guardianSigned = true
        ..guardianId = Uint8List.fromList(<int>[1])
        ..consent = true;
      expect(state.isReady, isTrue);
    });

    test('recoverable upload failure preserves the selected ID for retry', () {
      final id = Uint8List.fromList(<int>[1, 2, 3]);
      final state = SigningState()
        ..guardianId = id
        ..error = 'Network connection error.';
      expect(state.guardianId, same(id));
      expect(state.error, contains('Network'));
    });

    test('invalidates session after signed form data changes', () {
      final state = SigningState()
        ..sessionId = 'session-1'
        ..studentSigned = true
        ..guardianSigned = true;
      state.invalidateIfFormChanged(<String, dynamic>{'name': 'A'});
      state.invalidateIfFormChanged(<String, dynamic>{'name': 'B'});
      expect(state.sessionId, isNull);
      expect(state.studentSigned, isFalse);
      expect(state.guardianSigned, isFalse);
    });

    test('expired sessions require signing again', () {
      final state = SigningState()
        ..sessionId = 'session-1'
        ..studentSigned = true
        ..guardianSigned = true;
      state.markExpired();
      expect(state.sessionId, isNull);
      expect(state.error, contains('expired'));
    });

    test('provider retains duplicate-submission prevention', () {
      final source = File(
        'lib/features/forms/presentation/providers/new_scholar_provider.dart',
      ).readAsStringSync();
      expect(source, contains('if (_isLoading) return false;'));
    });
  });
}
