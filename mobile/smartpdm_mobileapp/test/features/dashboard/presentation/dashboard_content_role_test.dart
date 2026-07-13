import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/controllers/applicant_home_controller.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/screens/dashboard_screen.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/applicant_documents_package.dart';
import 'package:smartpdm_mobileapp/shared/models/application_status_summary.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(const {});
  });

  testWidgets('resolved applicant access mounts only Applicant Home', (
    tester,
  ) async {
    final controller = _applicantController();
    addTearDown(controller.dispose);

    await _pumpDashboard(
      tester,
      controller: controller,
      resolver: (_, _) async => false,
    );

    expect(
      find.byKey(const ValueKey('applicant-home-coordinator')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('legacy-scholar-dashboard')),
      findsNothing,
    );
  });

  testWidgets('resolved scholar access preserves the legacy dashboard branch', (
    tester,
  ) async {
    await _pumpDashboard(tester, resolver: (_, _) async => true);

    expect(
      find.byKey(const ValueKey('legacy-scholar-dashboard')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('applicant-home-coordinator')),
      findsNothing,
    );
  });

  testWidgets('default role resolution fails closed when session read fails', (
    tester,
  ) async {
    await _pumpDashboard(tester, sessionService: _ThrowingSessionService());

    expect(find.text('We could not load Home right now.'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('applicant-home-coordinator')),
      findsNothing,
    );
    expect(
      find.byKey(const ValueKey('legacy-scholar-dashboard')),
      findsNothing,
    );
  });

  testWidgets('Applicant Home primary action keeps the existing destination', (
    tester,
  ) async {
    final provider = NotificationProvider();
    final controller = _applicantController();
    addTearDown(provider.dispose);
    addTearDown(controller.dispose);
    RouteSettings? pushedSettings;

    await tester.pumpWidget(
      ChangeNotifierProvider<NotificationProvider>.value(
        value: provider,
        child: MaterialApp(
          onGenerateRoute: (settings) {
            pushedSettings = settings;
            return MaterialPageRoute<void>(
              settings: settings,
              builder: (_) => const Scaffold(body: Text('Scholarships')),
            );
          },
          home: Scaffold(
            body: DashboardContent(
              applicantHomeController: controller,
              scholarAccessResolver: (_, _) async => false,
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    await tester.tap(find.text('View scholarships'));
    await tester.pumpAndSettle();

    expect(pushedSettings?.name, AppRoutes.scholarshipOpenings);
    expect(find.text('Scholarships'), findsOneWidget);
  });
}

Future<void> _pumpDashboard(
  WidgetTester tester, {
  ApplicantHomeController? controller,
  DashboardScholarAccessResolver? resolver,
  SessionService sessionService = const SessionService(),
}) async {
  final provider = NotificationProvider();
  addTearDown(provider.dispose);

  await tester.pumpWidget(
    ChangeNotifierProvider<NotificationProvider>.value(
      value: provider,
      child: MaterialApp(
        home: Scaffold(
          body: DashboardContent(
            applicantHomeController: controller,
            sessionService: sessionService,
            scholarAccessResolver: resolver,
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.pump();
}

ApplicantHomeController _applicantController() {
  return ApplicantHomeController(
    loadIdentity: () async => const SessionUser(
      token: 'token',
      userId: 'user-id',
      email: 'applicant@example.com',
      studentId: 'PDM-2026-001001',
      firstName: 'Teresa',
      lastName: 'Tolentino',
    ),
    loadOpenings: () async => ProgramOpeningsResult(
      hasSavedDraft: false,
      draftOpeningId: '',
      draftOpeningTitle: '',
      draftProgramName: '',
      activeApplicationId: '',
      activeOpeningId: '',
      isApprovedScholar: false,
      items: const [],
    ),
    loadDocuments: () async => const ApplicantDocumentsPackage(
      applicationId: '',
      contextId: '',
      contextTitle: 'Scholarship requirements',
      programName: 'Scholarship program',
      applicationStatus: '',
      documentStatus: '',
      documents: [],
    ),
    loadStatus: () async =>
        const ApplicationStatusSummary(hasApplication: false),
    loadLatestUpdate: () async => null,
    refreshInterval: null,
  );
}

class _ThrowingSessionService extends SessionService {
  @override
  Future<SessionUser> getCurrentUser() =>
      Future<SessionUser>.error(StateError('Session unavailable'));
}
