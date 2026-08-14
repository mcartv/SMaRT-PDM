import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/screens/dashboard_screen.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(const {});
  });

  testWidgets('unified dashboard renders applicant identity and access state', (
    tester,
  ) async {
    await _pumpDashboard(
      tester,
      sessionService: const _FakeSessionService(hasScholarAccess: false),
    );

    expect(find.text('Welcome, Teresa'), findsOneWidget);
    expect(find.text('PDM-2026-001001'), findsOneWidget);
    expect(find.text('APPLICANT'), findsOneWidget);
    expect(find.text('How to use SMaRT-PDM'), findsOneWidget);
  });

  testWidgets('unified dashboard renders scholar identity and access state', (
    tester,
  ) async {
    await _pumpDashboard(
      tester,
      sessionService: const _FakeSessionService(hasScholarAccess: true),
    );

    expect(find.text('Welcome, Teresa'), findsOneWidget);
    expect(find.text('PDM-2026-001001'), findsOneWidget);
    expect(find.text('SCHOLAR'), findsOneWidget);
    expect(find.text('Scholar Responsibilities'), findsOneWidget);
    expect(find.text('How to use SMaRT-PDM'), findsNothing);
  });

  testWidgets('session read failure shows a controlled Home error state', (
    tester,
  ) async {
    await _pumpDashboard(tester, sessionService: _ThrowingSessionService());

    expect(find.text('We could not load Home right now.'), findsOneWidget);
    expect(
      find.text('Your account session could not be loaded. Please try again.'),
      findsOneWidget,
    );
    expect(find.text('Try again'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Future<void> _pumpDashboard(
  WidgetTester tester, {
  required SessionService sessionService,
}) async {
  final provider = NotificationProvider();
  addTearDown(provider.dispose);

  await tester.pumpWidget(
    ChangeNotifierProvider<NotificationProvider>.value(
      value: provider,
      child: MaterialApp(
        home: Scaffold(body: DashboardContent(sessionService: sessionService)),
      ),
    ),
  );

  await tester.pump();
  await tester.pump();
}

class _FakeSessionService extends SessionService {
  const _FakeSessionService({required this.hasScholarAccess});

  final bool hasScholarAccess;

  @override
  Future<SessionUser> getCurrentUser() async => SessionUser(
    token: 'token',
    userId: 'user-id',
    email: 'teresa@example.com',
    studentId: 'PDM-2026-001001',
    firstName: 'Teresa',
    lastName: 'Tolentino',
    hasScholarAccess: hasScholarAccess,
  );
}

class _ThrowingSessionService extends SessionService {
  @override
  Future<SessionUser> getCurrentUser() =>
      Future<SessionUser>.error(StateError('Session unavailable'));
}
