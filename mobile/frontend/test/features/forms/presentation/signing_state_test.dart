import 'dart:typed_data';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_signing.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:flutter/material.dart';

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

    test(
      'invalidates the session after signed form data changes without claiming drawn signatures are empty',
      () {
        final state = SigningState()
          ..sessionId = 'session-1'
          ..studentSigned = true
          ..guardianSigned = true;
        state.invalidateIfFormChanged(<String, dynamic>{'name': 'A'});
        state.invalidateIfFormChanged(<String, dynamic>{'name': 'B'});
        expect(state.sessionId, isNull);
        expect(state.studentSigned, isTrue);
        expect(state.guardianSigned, isTrue);
        expect(state.validationMessage, contains('Reconfirm'));
      },
    );

    test('form fingerprints are stable when map key order differs', () {
      final state = SigningState()
        ..sessionId = 'session-1'
        ..studentSigned = true
        ..guardianSigned = true;
      state.invalidateIfFormChanged(<String, dynamic>{
        'personal': <String, dynamic>{'name': 'Ada', 'age': 18},
        'opening_id': 'opening-1',
      });
      state.invalidateIfFormChanged(<String, dynamic>{
        'opening_id': 'opening-1',
        'personal': <String, dynamic>{'age': 18, 'name': 'Ada'},
      });
      expect(state.sessionId, 'session-1');
    });

    test('optional family phones are canonical in each submission payload', () {
      final data = ApplicationData()
        ..fatherMobile = ''
        ..motherMobile = '  '
        ..guardianMobile = 'n/a';
      final family =
          data.toSubmissionPayload()['family'] as Map<String, dynamic>;
      expect((family['father'] as Map<String, dynamic>)['mobile'], 'N/A');
      expect((family['mother'] as Map<String, dynamic>)['mobile'], 'N/A');
      expect((family['guardian'] as Map<String, dynamic>)['mobile'], 'N/A');
    });

    test(
      'signature controllers remain owned by SigningState across step rebuilds',
      () {
        final state = SigningState();
        state.studentPad.begin(const Offset(4, 4));
        state.guardianPad.begin(const Offset(8, 8));
        state.markUploaded('session-1', <String, dynamic>{'opening_id': 'one'});
        expect(state.studentPad.isEmpty, isFalse);
        expect(state.guardianPad.isEmpty, isFalse);
        expect(
          state.isReady,
          isFalse,
        ); // Guardian ID and consent are still required.
      },
    );

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

    test(
      'signing upload is single-flight and releases retry after completion',
      () {
        final state = SigningState();
        final first = state.beginUpload();
        expect(first, isNotNull);
        expect(state.beginUpload(), isNull);
        state.finishUpload(first!);
        expect(state.beginUpload(), isNotNull);
      },
    );

    test(
      'certification has one authoritative model value and routes to Submit',
      () {
        final submit = File(
          'lib/features/forms/presentation/screens/step_submit.dart',
        ).readAsStringSync();
        final applicant = File(
          'lib/features/applicant/presentation/screens/new_applicant_screen.dart',
        ).readAsStringSync();
        expect(submit, contains('value: widget.data.certificationRead'));
        expect(submit, contains('value: widget.data.agree'));
        expect(submit, isNot(contains('late bool certRead')));
        expect(
          applicant,
          contains(
            RegExp(
              r'case ApplicationSubmissionSection\.certification:\s+return 5;',
            ),
          ),
        );
      },
    );

    test(
      'step keys are unique while AnimatedSwitcher keeps two steps mounted',
      () {
        final source = File(
          'lib/features/applicant/presentation/screens/new_applicant_screen.dart',
        ).readAsStringSync();
        expect(source, contains('List<GlobalKey>.generate'));
        expect(source, contains('key: _stepContentKeys[_step]'));
        expect(source, isNot(contains('final _stepContentKey = GlobalKey()')));
      },
    );
  });
}
