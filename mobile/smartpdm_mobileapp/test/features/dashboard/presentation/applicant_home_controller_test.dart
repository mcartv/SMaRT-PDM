import 'dart:async';

import 'package:flutter_test/flutter_test.dart';

import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/controllers/applicant_home_controller.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/models/applicant_home_presentation.dart';
import 'package:smartpdm_mobileapp/shared/models/applicant_documents_package.dart';
import 'package:smartpdm_mobileapp/shared/models/application_status_summary.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';

void main() {
  group('ApplicantHomeController', () {
    test('coalesces overlapping requests for the same section', () async {
      final completer = Completer<ProgramOpeningsResult>();
      var calls = 0;
      final controller = _controller(
        loadOpenings: () {
          calls += 1;
          return completer.future;
        },
      );
      addTearDown(controller.dispose);

      final first = controller.retryOpenings();
      final second = controller.retryOpenings();

      expect(calls, 1);
      expect(controller.state.openings.isInitialLoading, isTrue);

      completer.complete(_openings());
      await Future.wait([first, second]);

      expect(calls, 1);
      expect(controller.state.openings.data?.items, hasLength(1));
      expect(controller.state.openings.hasError, isFalse);
    });

    test(
      'retains cached section data and hides exception text on failure',
      () async {
        var shouldFail = false;
        final controller = _controller(
          loadOpenings: () async {
            if (shouldFail) {
              throw Exception('private bb1aded0-83d5-4985-9801-8dd8d461a06a');
            }
            return _openings();
          },
        );
        addTearDown(controller.dispose);

        await controller.retryOpenings();
        final cached = controller.state.openings.data;

        shouldFail = true;
        await controller.retryOpenings();

        expect(controller.state.openings.data, same(cached));
        expect(controller.state.openings.isStale, isTrue);
        expect(
          controller.state.openings.failure?.userMessage,
          'This section is unavailable right now.',
        );
        expect(
          controller.state.openings.failure?.userMessage,
          isNot(contains('bb1aded0')),
        );
      },
    );

    test(
      'external application refresh targets only status and documents',
      () async {
        var identityCalls = 0;
        var openingCalls = 0;
        var documentCalls = 0;
        var statusCalls = 0;
        var updateCalls = 0;
        final controller = _controller(
          loadIdentity: () async {
            identityCalls += 1;
            return _identity;
          },
          loadOpenings: () async {
            openingCalls += 1;
            return _openings();
          },
          loadDocuments: () async {
            documentCalls += 1;
            return _documents;
          },
          loadStatus: () async {
            statusCalls += 1;
            return const ApplicationStatusSummary(hasApplication: false);
          },
          loadLatestUpdate: () async {
            updateCalls += 1;
            return null;
          },
        );
        addTearDown(controller.dispose);

        await controller.refreshForExternalChange();

        expect(identityCalls, 0);
        expect(openingCalls, 0);
        expect(documentCalls, 1);
        expect(statusCalls, 1);
        expect(updateCalls, 0);
      },
    );

    test(
      'full refresh triggers coalesce and load every section once',
      () async {
        final gate = Completer<void>();
        var identityCalls = 0;
        var openingCalls = 0;
        var documentCalls = 0;
        var statusCalls = 0;
        var updateCalls = 0;
        final controller = _controller(
          loadIdentity: () async {
            identityCalls += 1;
            await gate.future;
            return _identity;
          },
          loadOpenings: () async {
            openingCalls += 1;
            await gate.future;
            return _openings();
          },
          loadDocuments: () async {
            documentCalls += 1;
            await gate.future;
            return _documents;
          },
          loadStatus: () async {
            statusCalls += 1;
            await gate.future;
            return const ApplicationStatusSummary(hasApplication: false);
          },
          loadLatestUpdate: () async {
            updateCalls += 1;
            await gate.future;
            return null;
          },
        );
        addTearDown(controller.dispose);

        final first = controller.refresh();
        final second = controller.refresh();
        expect(identical(first, second), isTrue);
        expect([
          identityCalls,
          openingCalls,
          documentCalls,
          statusCalls,
          updateCalls,
        ], everyElement(1));

        gate.complete();
        await first;

        expect(controller.state.latestUpdate.hasLoaded, isTrue);
        expect(controller.state.latestUpdate.data, isNull);
      },
    );

    test(
      'external revision queues one trailing refresh behind an active request',
      () async {
        final responses = <Completer<ProgramOpeningsResult>>[
          Completer<ProgramOpeningsResult>(),
          Completer<ProgramOpeningsResult>(),
        ];
        var calls = 0;
        final controller = _controller(
          loadOpenings: () => responses[calls++].future,
        );
        addTearDown(controller.dispose);

        final activeRequest = controller.retryOpenings();
        final externalRefresh = controller.refreshForExternalChange(
          sections: const {ApplicantHomeSectionKey.openings},
        );

        expect(calls, 1);
        responses.first.complete(_openings(title: 'Earlier opening'));
        await activeRequest;
        await Future<void>.delayed(Duration.zero);

        expect(calls, 2);
        responses.last.complete(_openings(title: 'Latest opening'));
        await externalRefresh;

        expect(
          controller.state.openings.data?.items.single.title,
          'Latest opening',
        );
      },
    );

    test('dispose cancels updates from an older response', () async {
      final completer = Completer<ApplicationStatusSummary>();
      final controller = _controller(loadStatus: () => completer.future);

      final request = controller.retryApplicationStatus();
      expect(controller.state.applicationStatus.isLoading, isTrue);

      controller.dispose();
      completer.complete(const ApplicationStatusSummary(hasApplication: false));
      await request;

      expect(controller.isDisposed, isTrue);
      expect(controller.state.applicationStatus.hasLoaded, isFalse);
      expect(controller.state.applicationStatus.data, isNull);
    });

    test('section retry only invokes the requested loader', () async {
      var identityCalls = 0;
      var openingCalls = 0;
      final controller = _controller(
        loadIdentity: () async {
          identityCalls += 1;
          return _identity;
        },
        loadOpenings: () async {
          openingCalls += 1;
          return _openings();
        },
      );
      addTearDown(controller.dispose);

      await controller.retryIdentity();

      expect(identityCalls, 1);
      expect(openingCalls, 0);
      expect(controller.state.identity.data?.displayName, 'Teresa Tolentino');
    });

    testWidgets('periodic refresh is cancelled on dispose', (tester) async {
      var identityCalls = 0;
      final controller = _controller(
        loadIdentity: () async {
          identityCalls += 1;
          return _identity;
        },
        refreshInterval: const Duration(seconds: 8),
      );

      await controller.start();
      expect(identityCalls, 1);

      await tester.pump(const Duration(seconds: 8));
      await tester.pump();
      expect(identityCalls, 2);

      controller.dispose();
      await tester.pump(const Duration(seconds: 16));
      expect(identityCalls, 2);
    });
  });
}

const SessionUser _identity = SessionUser(
  token: 'token',
  userId: 'user-id',
  email: 'teresa@example.com',
  studentId: 'PDM-2026-001001',
  firstName: 'Teresa',
  lastName: 'Tolentino',
);

const ApplicantDocumentsPackage _documents = ApplicantDocumentsPackage(
  applicationId: 'application-id',
  contextId: 'opening-id',
  contextTitle: 'Opening',
  programName: 'Program',
  applicationStatus: 'Pending Review',
  documentStatus: 'Missing Docs',
  documents: [],
);

ProgramOpeningsResult _openings({String title = 'Genmart Opening'}) =>
    ProgramOpeningsResult(
      hasSavedDraft: false,
      draftOpeningId: '',
      draftOpeningTitle: '',
      draftProgramName: '',
      activeApplicationId: '',
      activeOpeningId: '',
      isApprovedScholar: false,
      items: [
        ProgramOpening(
          openingId: 'opening-id',
          programId: 'program-id',
          openingTitle: title,
          programName: 'Genmart',
          applicationStart: '2026-07-01',
          applicationEnd: '2026-07-31',
          postingStatus: 'posted',
          announcementText: '',
          isTes: false,
          hasApplied: false,
          canReapply: false,
          canApply: true,
          applyLabel: 'Apply now',
          uploadedDocumentCount: 0,
          requiredDocumentCount: 4,
        ),
      ],
    );

ApplicantHomeController _controller({
  ApplicantHomeIdentityLoader? loadIdentity,
  ApplicantHomeOpeningsLoader? loadOpenings,
  ApplicantHomeDocumentsLoader? loadDocuments,
  ApplicantHomeStatusLoader? loadStatus,
  ApplicantHomeLatestUpdateLoader? loadLatestUpdate,
  Duration? refreshInterval,
}) {
  return ApplicantHomeController(
    loadIdentity: loadIdentity ?? () async => _identity,
    loadOpenings: loadOpenings ?? () async => _openings(),
    loadDocuments: loadDocuments ?? () async => _documents,
    loadStatus:
        loadStatus ??
        () async => const ApplicationStatusSummary(hasApplication: false),
    loadLatestUpdate: loadLatestUpdate ?? () async => null,
    refreshInterval: refreshInterval,
  );
}
