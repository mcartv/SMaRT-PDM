import 'package:flutter_test/flutter_test.dart';

import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/mappers/applicant_home_mapper.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/models/applicant_home_presentation.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/shared/models/applicant_documents_package.dart';
import 'package:smartpdm_mobileapp/shared/models/application_status_summary.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';

void main() {
  const mapper = ApplicantHomeMapper();

  group('ApplicantHomeMapper', () {
    test('maps identity without exposing UUID-shaped internal values', () {
      const uuid = 'bb1aded0-83d5-4985-9801-8dd8d461a06a';
      final result = mapper.mapIdentity(
        const SessionUser(
          token: 'secret',
          userId: uuid,
          email: 'applicant@example.com',
          studentId: uuid,
          firstName: 'Teresa',
          lastName: 'Tolentino',
        ),
      );

      expect(result.displayName, 'Teresa Tolentino');
      expect(result.studentNumber, 'Student number unavailable');
      expect(result.studentNumber, isNot(contains(uuid)));
    });

    test('limits openings and formats dates instead of exposing ISO text', () {
      final result = mapper.mapOpenings(
        ProgramOpeningsResult(
          hasSavedDraft: false,
          draftOpeningId: '',
          draftOpeningTitle: '',
          draftProgramName: '',
          activeApplicationId: '',
          activeOpeningId: '',
          isApprovedScholar: false,
          items: List.generate(
            5,
            (index) => _opening(
              index: index,
              start: '2026-07-01T00:00:00.000Z',
              end: '2026-07-31T23:59:59.000Z',
            ),
          ),
        ),
      );

      expect(result.items, hasLength(3));
      expect(
        () => result.items.add(result.items.first),
        throwsUnsupportedError,
      );
      expect(result.items.first.applicationPeriod, '1 Jul 2026 – 31 Jul 2026');
      expect(result.items.first.applicationPeriod, isNot(contains('T00:00')));
      expect(
        result.items.first.action.target,
        ApplicantHomeActionTarget.scholarships,
      );
      expect(result.items.first.action.label, 'Review opening');
    });

    test('maps genuine empty latest update to null', () {
      expect(mapper.mapLatestUpdate(null), isNull);
    });

    test('does not expose notification reference type or UUID in copy', () {
      const uuid = 'bb1aded0-83d5-4985-9801-8dd8d461a06a';
      final result = mapper.mapLatestUpdate(
        AppNotification(
          notificationId: uuid,
          userId: uuid,
          type: 'internal_unknown_type',
          title: 'Application $uuid update',
          message:
              'Published 2026-07-13T10:30:00Z requirements.missing private_reference_type',
          referenceId: uuid,
          referenceType: 'private_reference_type',
          isRead: false,
          pushSent: false,
          createdAt: DateTime.utc(2026, 7, 13),
        ),
      )!;

      final visibleText = [
        result.title,
        result.summary,
        result.categoryLabel,
        result.publishedLabel,
        result.action.label,
      ].join(' ');
      expect(visibleText, isNot(contains(uuid)));
      expect(visibleText, isNot(contains('private_reference_type')));
      expect(visibleText, isNot(contains('requirements.missing')));
      expect(visibleText, isNot(contains('2026-07-13T10:30:00Z')));
      expect(result.categoryLabel, 'Office update');
    });

    test('maps missing requirements with a safe action and actual count', () {
      final summary = _summary(
        blocker: 'requirements.missing',
        requirements: 'missing',
      );
      final documents = _documents(submitted: 1, required: 4);

      final status = mapper.mapApplicationStatus(summary, documents: documents);
      final progress = mapper.mapProgress(summary);

      expect(status.stage, ApplicantHomeStage.requirements);
      expect(status.description, contains('3 remaining documents'));
      expect(status.primaryAction.target, ApplicantHomeActionTarget.documents);
      expect(progress, hasLength(3));
      expect(progress.first.status, 'Documents needed');
      expect(progress.first.status, isNot(contains('requirements.missing')));
    });

    test('unknown workflow values fall back without rendering raw codes', () {
      final summary = _summary(
        stage: 'private_backend_stage',
        blocker: 'private.blocker_code',
        requirements: 'private_requirements_code',
        endorsement: 'private_endorsement_code',
        activation: 'private_activation_code',
      );

      final status = mapper.mapApplicationStatus(summary);
      final progress = mapper.mapProgress(summary);
      final visibleText = [
        status.title,
        status.description,
        status.semanticLabel,
        ...progress.expand((item) => [item.label, item.status]),
      ].join(' ');

      expect(status.stage, ApplicantHomeStage.submitted);
      expect(visibleText, isNot(contains('private_')));
      expect(visibleText, isNot(contains('blocker_code')));
    });

    test('known primary blocker wins over contradictory fallback statuses', () {
      final status = mapper.mapApplicationStatus(
        _summary(
          blocker: 'endorsement.rejected',
          requirements: 'rejected',
          endorsement: 'rejected',
        ),
      );

      expect(status.stage, ApplicantHomeStage.attention);
      expect(status.stepLabel, 'Step 3 of 4');
      expect(
        status.primaryAction.target,
        ApplicantHomeActionTarget.endorsement,
      );
    });

    test('maps activation lifecycle without exposing raw workflow values', () {
      final pending = mapper.mapApplicationStatus(
        _summary(
          stage: 'ready_for_activation',
          requirements: 'approved',
          endorsement: 'approved',
          activation: 'ready_for_activation',
        ),
      );
      final active = mapper.mapApplicationStatus(
        _summary(
          stage: 'scholar_activated',
          requirements: 'approved',
          endorsement: 'approved',
          activation: 'activated',
        ),
      );

      expect(pending.stage, ApplicantHomeStage.activation);
      expect(active.stage, ApplicantHomeStage.active);
      expect(pending.semanticLabel, isNot(contains('ready_for_activation')));
      expect(active.semanticLabel, isNot(contains('scholar_activated')));
    });

    test(
      'saved draft takes precedence when there is no submitted application',
      () {
        final status = mapper.mapApplicationStatus(
          const ApplicationStatusSummary(hasApplication: false),
          openings: ProgramOpeningsResult(
            hasSavedDraft: true,
            draftOpeningId: 'opening-id',
            draftOpeningTitle: 'Draft opening',
            draftProgramName: 'Program',
            activeApplicationId: 'application-id',
            activeOpeningId: '',
            isApprovedScholar: false,
            items: const [],
          ),
        );

        expect(status.stage, ApplicantHomeStage.draft);
        expect(
          status.primaryAction.target,
          ApplicantHomeActionTarget.application,
        );
        expect(status.semanticLabel, isNot(contains('opening-id')));
        expect(status.semanticLabel, isNot(contains('application-id')));
      },
    );
  });
}

ProgramOpening _opening({
  required int index,
  String start = '',
  String end = '',
}) {
  return ProgramOpening(
    openingId: 'opening-$index',
    programId: 'program-$index',
    openingTitle: 'Opening $index',
    programName: 'Program $index',
    applicationStart: start,
    applicationEnd: end,
    postingStatus: 'posted',
    announcementText: '',
    isTes: false,
    hasApplied: false,
    canReapply: false,
    canApply: true,
    applyLabel: 'raw-server-label',
    uploadedDocumentCount: 0,
    requiredDocumentCount: 4,
  );
}

ApplicantDocumentsPackage _documents({
  required int submitted,
  required int required,
}) {
  return ApplicantDocumentsPackage(
    applicationId: 'application-id',
    contextId: 'opening-id',
    contextTitle: 'Opening',
    programName: 'Program',
    applicationStatus: 'internal_application_status',
    documentStatus: 'internal_document_status',
    documents: List.generate(
      required,
      (index) => ApplicantRequirementDocument(
        id: 'document-$index',
        documentType: 'Document $index',
        routeParam: 'document-$index',
        isSubmitted: index < submitted,
        status: index < submitted ? 'uploaded' : 'pending',
      ),
    ),
  );
}

ApplicationStatusSummary _summary({
  String stage = 'requirements_review',
  String? blocker,
  String requirements = 'under_review',
  String endorsement = 'pending_sdo',
  String activation = 'not_ready',
}) {
  return ApplicationStatusSummary(
    hasApplication: true,
    applicationId: 'application-id',
    applicationStatus: 'raw_application_status',
    documentStatus: 'raw_document_status',
    workflow: ApplicationWorkflowSummary(
      stage: stage,
      stageLabel: 'Raw stage label',
      requirements: WorkflowStateSummary(
        status: requirements,
        statusLabel: 'Raw requirements label',
      ),
      endorsement: EndorsementStateSummary(
        status: endorsement,
        statusLabel: 'Raw endorsement label',
        currentStage: endorsement,
        slip: const EndorsementSlipSummary(available: false),
      ),
      scholarActivation: WorkflowStateSummary(
        status: activation,
        statusLabel: 'Raw activation label',
      ),
      officeReviews: const {},
      blockers: blocker == null
          ? const []
          : [
              WorkflowBlocker(
                code: blocker,
                source: 'private_source',
                message: 'Private server message',
              ),
            ],
      primaryBlocker: blocker == null
          ? null
          : WorkflowBlocker(
              code: blocker,
              source: 'private_source',
              message: 'Private server message',
            ),
    ),
  );
}
