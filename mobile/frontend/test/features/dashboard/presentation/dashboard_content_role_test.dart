import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/screens/dashboard_screen.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_service.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/printable_application_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/application_status_summary.dart';

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
    expect(find.text('Latest Announcements'), findsOneWidget);
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
    expect(find.text('Scholar Updates'), findsOneWidget);
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

  testWidgets(
    'shows the signed Form-02 action only for a submitted application',
    (tester) async {
      final printable = _FakePrintableApplicationService();
      await _pumpDashboard(
        tester,
        sessionService: const _FakeSessionService(hasScholarAccess: false),
        applicationService: _FakeApplicationService(
          const ApplicationStatusSummary(
            hasApplication: true,
            applicationId: 'submitted-application',
            applicationStatus: 'Pending Review',
          ),
        ),
        printableApplicationService: printable,
      );

      await tester.pump(const Duration(milliseconds: 300));
      final downloadAction = find.byKey(
        const ValueKey<String>('download-signed-application-form'),
      );
      await tester.ensureVisible(downloadAction);
      expect(find.text('Download Signed Application Form'), findsOneWidget);
      final actionSurface = find.descendant(
        of: downloadAction,
        matching: find.byType(InkWell),
      );
      tester.widget<InkWell>(actionSurface).onTap!.call();
      await tester.pump();

      expect(printable.submittedFormRequests, 1);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
      await _pumpDashboard(
        tester,
        sessionService: const _FakeSessionService(hasScholarAccess: false),
        applicationService: _FakeApplicationService(
          const ApplicationStatusSummary(hasApplication: false),
        ),
      );
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Download Signed Application Form'), findsNothing);
    },
  );

  testWidgets('signed Form-02 action remains usable on compact widths', (
    tester,
  ) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    for (final width in <double>[320, 360, 390]) {
      tester.view
        ..physicalSize = Size(width, 800)
        ..devicePixelRatio = 1;
      await _pumpDashboard(
        tester,
        sessionService: const _FakeSessionService(hasScholarAccess: false),
        applicationService: _FakeApplicationService(
          const ApplicationStatusSummary(
            hasApplication: true,
            applicationId: 'submitted-application',
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 300));

      expect(
        find.byKey(const ValueKey<String>('download-signed-application-form')),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    }
  });
}

Future<void> _pumpDashboard(
  WidgetTester tester, {
  required SessionService sessionService,
  ApplicationService? applicationService,
  PrintableApplicationService? printableApplicationService,
}) async {
  final provider = NotificationProvider();
  addTearDown(provider.dispose);

  await tester.pumpWidget(
    ChangeNotifierProvider<NotificationProvider>.value(
      value: provider,
      child: MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: Scaffold(
            body: DashboardContent(
              sessionService: sessionService,
              applicationService: applicationService,
              printableApplicationService: printableApplicationService,
              signedApplicationPdfSaver:
                  ({
                    required bytes,
                    required fileName,
                    required contentType,
                  }) async => 'Download started.',
            ),
          ),
        ),
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

class _FakeApplicationService extends ApplicationService {
  _FakeApplicationService(this.summary);

  final ApplicationStatusSummary summary;

  @override
  Future<ApplicationStatusSummary> fetchMyApplicationStatusSummary() async =>
      summary;
}

class _FakePrintableApplicationService extends PrintableApplicationService {
  var submittedFormRequests = 0;

  @override
  Future<Uint8List> generateBytesFromMySubmittedApplicationForm() async {
    submittedFormRequests += 1;
    return Uint8List.fromList(<int>[37, 80, 68, 70]);
  }
}
