import 'package:flutter_test/flutter_test.dart';

import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/controllers/applicant_home_role_resolver.dart';

void main() {
  group('ApplicantHomeRoleResolver', () {
    test(
      'uses cached scholar access without waiting for profile data',
      () async {
        var profileCalls = 0;
        final resolver = ApplicantHomeRoleResolver(
          sessionService: _FakeSessionService([
            _session(hasScholarAccess: true),
          ]),
          loadProfile: () async {
            profileCalls += 1;
            return const {'has_scholar_access': false};
          },
        );

        expect(await resolver.resolve(), isTrue);
        expect(profileCalls, 0);
      },
    );

    test('uses the focused profile result for an authenticated user', () async {
      final resolver = ApplicantHomeRoleResolver(
        sessionService: _FakeSessionService([_session()]),
        loadProfile: () async => const {'has_scholar_access': true},
      );

      expect(await resolver.resolve(), isTrue);
    });

    test('profile failure falls back to the latest cached role', () async {
      final resolver = ApplicantHomeRoleResolver(
        sessionService: _FakeSessionService([
          _session(),
          _session(hasScholarAccess: true),
        ]),
        loadProfile: () async =>
            throw Exception('push and socket are unrelated'),
      );

      expect(await resolver.resolve(), isTrue);
    });

    test(
      'live provider access selects the scholar branch immediately',
      () async {
        final sessionService = _FakeSessionService([_session()]);
        final resolver = ApplicantHomeRoleResolver(
          sessionService: sessionService,
          loadProfile: () async => const {'has_scholar_access': false},
        );

        expect(await resolver.resolve(liveScholarAccess: true), isTrue);
        expect(sessionService.readCount, 0);
      },
    );
  });
}

SessionUser _session({bool hasScholarAccess = false}) => SessionUser(
  token: 'token',
  userId: 'user-id',
  email: 'applicant@example.com',
  studentId: 'PDM-2026-001001',
  hasScholarAccess: hasScholarAccess,
);

class _FakeSessionService extends SessionService {
  _FakeSessionService(this._sessions);

  final List<SessionUser> _sessions;
  int readCount = 0;

  @override
  Future<SessionUser> getCurrentUser() async {
    final index = readCount.clamp(0, _sessions.length - 1);
    readCount += 1;
    return _sessions[index];
  }
}
