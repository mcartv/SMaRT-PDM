import 'package:intl/intl.dart';

import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/models/applicant_home_presentation.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/shared/models/applicant_documents_package.dart';
import 'package:smartpdm_mobileapp/shared/models/application_status_summary.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';

/// Converts existing API/session contracts into display-safe Applicant Home
/// values. Server-provided workflow labels, remarks, codes, and exception text
/// intentionally never cross this boundary.
class ApplicantHomeMapper {
  const ApplicantHomeMapper();

  static final RegExp _uuidPattern = RegExp(
    r'\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b',
  );
  static final RegExp _isoDateTimePattern = RegExp(
    r'\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b',
  );
  static final RegExp _workflowCodePattern = RegExp(
    r'\b(?:(?:requirements|endorsement|activation|scholar_activation)[._][a-z][a-z0-9_]*|ready_for_activation|scholar_activated|pending_sdo|pending_guidance|pending_pd|reupload_required|not_ready)\b',
    caseSensitive: false,
  );
  static final DateFormat _dateFormat = DateFormat('d MMM y');

  ApplicantHomeIdentityPresentation mapIdentity(SessionUser user) {
    final fullName = <String>[
      _displayContent(user.firstName),
      _displayContent(user.lastName),
    ].where((part) => part.isNotEmpty).join(' ');

    final studentNumber = _displayContent(user.studentId);

    return ApplicantHomeIdentityPresentation(
      displayName: fullName.isEmpty ? 'Applicant' : fullName,
      studentNumber: studentNumber.isEmpty
          ? 'Student number unavailable'
          : studentNumber,
      hasScholarAccess: user.hasScholarAccess,
    );
  }

  ApplicantHomeOpeningsPresentation mapOpenings(ProgramOpeningsResult result) {
    final items = result.items.take(3).map(_mapOpening).toList(growable: false);

    return ApplicantHomeOpeningsPresentation(
      items: items,
      hasSavedDraft: result.hasSavedDraft,
      draftOpeningId: result.hasSavedDraft
          ? _opaqueIdentifier(result.draftOpeningId)
          : null,
      draftApplicationId: result.hasSavedDraft
          ? _opaqueIdentifier(result.activeApplicationId)
          : null,
    );
  }

  ApplicantHomeDocumentsPresentation mapDocuments(
    ApplicantDocumentsPackage package,
  ) {
    final requiredCount = package.documents.length;
    final uploadedCount = package.uploadedCount.clamp(0, requiredCount);

    return ApplicantHomeDocumentsPresentation(
      uploadedCount: uploadedCount,
      requiredCount: requiredCount,
      missingCount: requiredCount - uploadedCount,
    );
  }

  ApplicantHomeUpdatePresentation? mapLatestUpdate(
    AppNotification? notification,
  ) {
    if (notification == null) return null;

    final referenceType = notification.referenceType?.trim() ?? '';
    final redactedFragments = <String>{
      if (referenceType.isNotEmpty) referenceType,
    };
    final title = _displayContent(
      notification.title,
      redactedFragments: redactedFragments,
    );
    final summary = _displayContent(
      notification.message,
      redactedFragments: redactedFragments,
    );

    return ApplicantHomeUpdatePresentation(
      title: title.isEmpty ? 'Office update' : title,
      summary: summary,
      publishedLabel: _dateFormat.format(notification.createdAt.toLocal()),
      categoryLabel: notification.isOpeningUpdate
          ? 'Scholarship'
          : notification.isAnnouncementNotification
          ? 'Announcement'
          : 'Office update',
      action: const ApplicantHomeActionPresentation(
        label: 'Read update',
        target: ApplicantHomeActionTarget.notifications,
      ),
    );
  }

  ApplicantHomeApplicationPresentation mapApplicationStatus(
    ApplicationStatusSummary summary, {
    ProgramOpeningsResult? openings,
    ApplicantDocumentsPackage? documents,
  }) {
    if (!summary.hasApplication) {
      if (openings?.hasSavedDraft == true) {
        return ApplicantHomeApplicationPresentation(
          stage: ApplicantHomeStage.draft,
          title: 'Continue your saved application',
          description:
              'Your progress is saved. Continue the form when you are ready.',
          stepLabel: 'Draft',
          semanticLabel:
              'Saved application draft. Continue your saved application.',
          tone: ApplicantHomeTone.inProgress,
          primaryAction: ApplicantHomeActionPresentation(
            label: 'Continue application',
            target: ApplicantHomeActionTarget.application,
            openingId: _opaqueIdentifier(openings?.draftOpeningId),
            applicationId: _opaqueIdentifier(openings?.activeApplicationId),
            openingTitle: _displayContent(openings?.draftOpeningTitle),
            programName: _displayContent(openings?.draftProgramName),
          ),
        );
      }

      return const ApplicantHomeApplicationPresentation(
        stage: ApplicantHomeStage.noApplication,
        title: 'Start your scholarship application',
        description:
            'Explore available scholarships and begin an application when you find the right fit.',
        semanticLabel:
            'No scholarship application. Start your scholarship application.',
        tone: ApplicantHomeTone.neutral,
        primaryAction: ApplicantHomeActionPresentation(
          label: 'View scholarships',
          target: ApplicantHomeActionTarget.scholarships,
        ),
      );
    }

    final workflow = summary.workflow;
    final blocker = _knownBlocker(workflow?.primaryBlocker?.code);
    final requirementsStatus = _knownRequirementsStatus(
      workflow?.requirements.status,
    );
    final endorsementStatus = _knownEndorsementStatus(
      workflow?.endorsement.status,
    );
    final stage = _knownStage(workflow?.stage);
    final hasKnownBlocker = blocker.isNotEmpty;

    if (blocker == 'requirements.missing' ||
        (!hasKnownBlocker && requirementsStatus == 'missing')) {
      final missingCount = documents == null
          ? null
          : (documents.documents.length - documents.uploadedCount).clamp(
              0,
              documents.documents.length,
            );
      final description = missingCount != null && missingCount > 0
          ? 'Upload the $missingCount remaining ${missingCount == 1 ? 'document' : 'documents'} so review can continue.'
          : 'Complete the missing documents so review can continue.';

      return ApplicantHomeApplicationPresentation(
        stage: ApplicantHomeStage.requirements,
        title: 'Upload your remaining documents',
        description: description,
        stepLabel: 'Step 2 of 4',
        semanticLabel:
            'Step 2 of 4, documents required. Upload your remaining documents.',
        tone: ApplicantHomeTone.actionRequired,
        primaryAction: const ApplicantHomeActionPresentation(
          label: 'Upload documents',
          target: ApplicantHomeActionTarget.documents,
        ),
      );
    }

    if (blocker == 'requirements.reupload_required' ||
        (!hasKnownBlocker && requirementsStatus == 'reupload_required')) {
      return const ApplicantHomeApplicationPresentation(
        stage: ApplicantHomeStage.requirements,
        title: 'Review documents needing changes',
        description:
            'One or more files need a clearer or corrected copy before review can continue.',
        stepLabel: 'Step 2 of 4',
        semanticLabel:
            'Step 2 of 4, changes requested. Review documents needing changes.',
        tone: ApplicantHomeTone.actionRequired,
        primaryAction: ApplicantHomeActionPresentation(
          label: 'Review documents',
          target: ApplicantHomeActionTarget.documents,
        ),
      );
    }

    if (blocker == 'endorsement.grade_document_missing') {
      return const ApplicantHomeApplicationPresentation(
        stage: ApplicantHomeStage.endorsement,
        title: 'Upload your current grades',
        description:
            'Your grade report is required before endorsement review can be completed.',
        stepLabel: 'Step 3 of 4',
        semanticLabel:
            'Step 3 of 4, grade report required. Upload your current grades.',
        tone: ApplicantHomeTone.actionRequired,
        primaryAction: ApplicantHomeActionPresentation(
          label: 'Upload grade report',
          target: ApplicantHomeActionTarget.documents,
        ),
      );
    }

    if (blocker == 'endorsement.held' ||
        (!hasKnownBlocker && endorsementStatus == 'held')) {
      return const ApplicantHomeApplicationPresentation(
        stage: ApplicantHomeStage.endorsement,
        title: 'Office review is on hold',
        description:
            'Review your endorsement status for the next action requested by the reviewing office.',
        stepLabel: 'Step 3 of 4',
        semanticLabel:
            'Step 3 of 4, endorsement on hold. Review your endorsement status.',
        tone: ApplicantHomeTone.actionRequired,
        primaryAction: ApplicantHomeActionPresentation(
          label: 'Review endorsement',
          target: ApplicantHomeActionTarget.endorsement,
        ),
      );
    }

    if (blocker == 'endorsement.major_offense' ||
        blocker == 'endorsement.rejected' ||
        blocker == 'requirements.rejected' ||
        (!hasKnownBlocker && requirementsStatus == 'rejected') ||
        (!hasKnownBlocker && endorsementStatus == 'rejected') ||
        (!hasKnownBlocker && endorsementStatus == 'major_offense')) {
      final requirementsIssue =
          blocker == 'requirements.rejected' ||
          (!hasKnownBlocker && requirementsStatus == 'rejected');

      return ApplicantHomeApplicationPresentation(
        stage: ApplicantHomeStage.attention,
        title: 'Your application needs attention',
        description: requirementsIssue
            ? 'Review your application status for the document decision and available next steps.'
            : 'Review the endorsement decision and available next steps.',
        stepLabel: requirementsIssue ? 'Step 2 of 4' : 'Step 3 of 4',
        semanticLabel:
            'Application needs attention. Review the recorded decision and available next steps.',
        tone: ApplicantHomeTone.danger,
        primaryAction: ApplicantHomeActionPresentation(
          label: requirementsIssue ? 'View status' : 'Review endorsement',
          target: requirementsIssue
              ? ApplicantHomeActionTarget.status
              : ApplicantHomeActionTarget.endorsement,
        ),
      );
    }

    if (blocker == 'requirements.under_review' ||
        (!hasKnownBlocker && requirementsStatus == 'under_review')) {
      return const ApplicantHomeApplicationPresentation(
        stage: ApplicantHomeStage.requirements,
        title: 'Your documents are being reviewed',
        description:
            'No action is needed right now. You can check your status for new decisions.',
        stepLabel: 'Step 2 of 4',
        semanticLabel:
            'Step 2 of 4, documents under review. No action is needed right now.',
        tone: ApplicantHomeTone.inProgress,
        primaryAction: ApplicantHomeActionPresentation(
          label: 'View status',
          target: ApplicantHomeActionTarget.status,
        ),
      );
    }

    if (stage == 'scholar_activated' ||
        _knownActivationStatus(workflow?.scholarActivation.status) ==
            'activated') {
      return const ApplicantHomeApplicationPresentation(
        stage: ApplicantHomeStage.active,
        title: 'Your scholarship is active',
        description:
            'Activation is complete. Your scholar access will be available shortly.',
        stepLabel: 'Step 4 of 4',
        semanticLabel: 'Step 4 of 4 complete. Your scholarship is active.',
        tone: ApplicantHomeTone.success,
        primaryAction: ApplicantHomeActionPresentation(
          label: 'View status',
          target: ApplicantHomeActionTarget.status,
        ),
      );
    }

    if (stage == 'ready_for_activation' ||
        _knownActivationStatus(workflow?.scholarActivation.status) == 'ready') {
      return const ApplicantHomeApplicationPresentation(
        stage: ApplicantHomeStage.activation,
        title: 'Awaiting scholar activation',
        description:
            'Requirements and endorsement are complete. Final activation is now pending.',
        stepLabel: 'Step 4 of 4',
        semanticLabel:
            'Step 4 of 4, awaiting scholar activation. No action is needed right now.',
        tone: ApplicantHomeTone.inProgress,
        primaryAction: ApplicantHomeActionPresentation(
          label: 'View status',
          target: ApplicantHomeActionTarget.status,
        ),
      );
    }

    if (_isEndorsementInProgress(stage, endorsementStatus)) {
      return const ApplicantHomeApplicationPresentation(
        stage: ApplicantHomeStage.endorsement,
        title: 'Your endorsement is in progress',
        description:
            'Your application is moving through office review. Track its progress for the next update.',
        stepLabel: 'Step 3 of 4',
        semanticLabel:
            'Step 3 of 4, endorsement in progress. Track your endorsement.',
        tone: ApplicantHomeTone.inProgress,
        primaryAction: ApplicantHomeActionPresentation(
          label: 'Track endorsement',
          target: ApplicantHomeActionTarget.endorsement,
        ),
      );
    }

    return const ApplicantHomeApplicationPresentation(
      stage: ApplicantHomeStage.submitted,
      title: 'Application received',
      description:
          'Your application has been submitted. Check its status for the next review update.',
      stepLabel: 'Step 1 of 4',
      semanticLabel:
          'Step 1 of 4, application received. Check your status for updates.',
      tone: ApplicantHomeTone.inProgress,
      primaryAction: ApplicantHomeActionPresentation(
        label: 'View status',
        target: ApplicantHomeActionTarget.status,
      ),
    );
  }

  List<ApplicantHomeProgressPresentation> mapProgress(
    ApplicationStatusSummary summary,
  ) {
    if (!summary.hasApplication) return const [];

    final workflow = summary.workflow;
    return List<ApplicantHomeProgressPresentation>.unmodifiable([
      _requirementsProgress(workflow?.requirements.status),
      _endorsementProgress(workflow?.endorsement.status),
      _activationProgress(
        workflow?.scholarActivation.status,
        workflowStage: workflow?.stage,
      ),
    ]);
  }

  ApplicantHomeOpeningPresentation _mapOpening(ProgramOpening opening) {
    final title = _displayContent(
      opening.openingTitle,
      disallowed: const {'unknown program', 'unassigned application'},
    );
    final programName = _displayContent(
      opening.programName,
      disallowed: const {'unknown program', 'unassigned application'},
    );
    final openingId = _opaqueIdentifier(opening.openingId) ?? '';
    final action = opening.hasApplied
        ? ApplicantHomeActionPresentation(
            label: 'View application',
            target: ApplicantHomeActionTarget.documents,
            openingId: openingId.isEmpty ? null : openingId,
            applicationId: _opaqueIdentifier(opening.existingApplicationId),
            openingTitle: title.isEmpty ? 'Scholarship' : title,
            programName: programName.isEmpty
                ? 'Scholarship program'
                : programName,
          )
        : ApplicantHomeActionPresentation(
            label: opening.canApply || opening.canReapply
                ? 'Review scholarship'
                : 'View scholarship',
            target: ApplicantHomeActionTarget.scholarships,
            openingId: openingId.isEmpty ? null : openingId,
            applicationId: _opaqueIdentifier(opening.existingApplicationId),
            openingTitle: title.isEmpty ? 'Scholarship' : title,
            programName: programName.isEmpty
                ? 'Scholarship program'
                : programName,
          );

    return ApplicantHomeOpeningPresentation(
      openingId: openingId,
      title: title.isEmpty ? 'Scholarship' : title,
      programName: programName.isEmpty ? 'Scholarship program' : programName,
      applicationPeriod: _applicationPeriod(opening),
      canApply: opening.canApply || opening.canReapply,
      actionLabel: action.label,
      action: action,
    );
  }

  ApplicantHomeProgressPresentation _requirementsProgress(String? rawStatus) {
    return switch (_knownRequirementsStatus(rawStatus)) {
      'missing' => const ApplicantHomeProgressPresentation(
        label: 'Requirements',
        status: 'Documents needed',
        description: 'Upload the remaining required files.',
        tone: ApplicantHomeTone.actionRequired,
        action: ApplicantHomeActionPresentation(
          label: 'Open documents',
          target: ApplicantHomeActionTarget.documents,
        ),
      ),
      'reupload_required' => const ApplicantHomeProgressPresentation(
        label: 'Requirements',
        status: 'Changes requested',
        description: 'Replace the files marked for correction.',
        tone: ApplicantHomeTone.actionRequired,
        action: ApplicantHomeActionPresentation(
          label: 'Review documents',
          target: ApplicantHomeActionTarget.documents,
        ),
      ),
      'under_review' => const ApplicantHomeProgressPresentation(
        label: 'Requirements',
        status: 'Being reviewed',
        tone: ApplicantHomeTone.inProgress,
        action: ApplicantHomeActionPresentation(
          label: 'View status',
          target: ApplicantHomeActionTarget.status,
        ),
      ),
      'verified' => const ApplicantHomeProgressPresentation(
        label: 'Requirements',
        status: 'Complete',
        tone: ApplicantHomeTone.success,
        action: ApplicantHomeActionPresentation(
          label: 'View documents',
          target: ApplicantHomeActionTarget.documents,
        ),
      ),
      'rejected' => const ApplicantHomeProgressPresentation(
        label: 'Requirements',
        status: 'Needs attention',
        tone: ApplicantHomeTone.danger,
        action: ApplicantHomeActionPresentation(
          label: 'View status',
          target: ApplicantHomeActionTarget.status,
        ),
      ),
      _ => const ApplicantHomeProgressPresentation(
        label: 'Requirements',
        status: 'Pending',
        tone: ApplicantHomeTone.neutral,
        action: ApplicantHomeActionPresentation(
          label: 'View status',
          target: ApplicantHomeActionTarget.status,
        ),
      ),
    };
  }

  ApplicantHomeProgressPresentation _endorsementProgress(String? rawStatus) {
    return switch (_knownEndorsementStatus(rawStatus)) {
      'pending_sdo' => const ApplicantHomeProgressPresentation(
        label: 'Endorsement',
        status: 'Waiting for SDO',
        tone: ApplicantHomeTone.inProgress,
        action: ApplicantHomeActionPresentation(
          label: 'Track endorsement',
          target: ApplicantHomeActionTarget.endorsement,
        ),
      ),
      'pending_guidance' => const ApplicantHomeProgressPresentation(
        label: 'Endorsement',
        status: 'Waiting for Guidance',
        tone: ApplicantHomeTone.inProgress,
        action: ApplicantHomeActionPresentation(
          label: 'Track endorsement',
          target: ApplicantHomeActionTarget.endorsement,
        ),
      ),
      'pending_pd' => const ApplicantHomeProgressPresentation(
        label: 'Endorsement',
        status: 'Waiting for Program Director',
        tone: ApplicantHomeTone.inProgress,
        action: ApplicantHomeActionPresentation(
          label: 'Track endorsement',
          target: ApplicantHomeActionTarget.endorsement,
        ),
      ),
      'completed' => const ApplicantHomeProgressPresentation(
        label: 'Endorsement',
        status: 'Complete',
        tone: ApplicantHomeTone.success,
        action: ApplicantHomeActionPresentation(
          label: 'View endorsement',
          target: ApplicantHomeActionTarget.endorsement,
        ),
      ),
      'held' => const ApplicantHomeProgressPresentation(
        label: 'Endorsement',
        status: 'On hold',
        tone: ApplicantHomeTone.actionRequired,
        action: ApplicantHomeActionPresentation(
          label: 'Review endorsement',
          target: ApplicantHomeActionTarget.endorsement,
        ),
      ),
      'rejected' || 'major_offense' => const ApplicantHomeProgressPresentation(
        label: 'Endorsement',
        status: 'Needs attention',
        tone: ApplicantHomeTone.danger,
        action: ApplicantHomeActionPresentation(
          label: 'Review endorsement',
          target: ApplicantHomeActionTarget.endorsement,
        ),
      ),
      _ => const ApplicantHomeProgressPresentation(
        label: 'Endorsement',
        status: 'Not started',
        tone: ApplicantHomeTone.neutral,
        action: ApplicantHomeActionPresentation(
          label: 'View status',
          target: ApplicantHomeActionTarget.status,
        ),
      ),
    };
  }

  ApplicantHomeProgressPresentation _activationProgress(
    String? rawStatus, {
    String? workflowStage,
  }) {
    final stage = _knownStage(workflowStage);
    final status = _knownActivationStatus(rawStatus);
    if (stage == 'scholar_activated' || status == 'activated') {
      return const ApplicantHomeProgressPresentation(
        label: 'Activation',
        status: 'Active',
        tone: ApplicantHomeTone.success,
        action: ApplicantHomeActionPresentation(
          label: 'View status',
          target: ApplicantHomeActionTarget.status,
        ),
      );
    }
    if (stage == 'ready_for_activation' || status == 'ready') {
      return const ApplicantHomeProgressPresentation(
        label: 'Activation',
        status: 'Awaiting activation',
        tone: ApplicantHomeTone.inProgress,
        action: ApplicantHomeActionPresentation(
          label: 'View status',
          target: ApplicantHomeActionTarget.status,
        ),
      );
    }

    return const ApplicantHomeProgressPresentation(
      label: 'Activation',
      status: 'Not ready',
      tone: ApplicantHomeTone.neutral,
      action: ApplicantHomeActionPresentation(
        label: 'View status',
        target: ApplicantHomeActionTarget.status,
      ),
    );
  }

  String? _applicationPeriod(ProgramOpening opening) {
    // Opening periods are calendar dates, not user-local event instants. Keep
    // the API date component stable instead of shifting a late UTC end time
    // into the following day in positive-offset time zones.
    final start = DateTime.tryParse(opening.applicationStart);
    final end = DateTime.tryParse(opening.applicationEnd);
    if (start != null && end != null) {
      return '${_dateFormat.format(start)} – ${_dateFormat.format(end)}';
    }
    if (start != null) return 'Opens ${_dateFormat.format(start)}';
    if (end != null) return 'Closes ${_dateFormat.format(end)}';
    return null;
  }

  bool _isEndorsementInProgress(String stage, String endorsementStatus) {
    return stage == 'endorsement_review' ||
        endorsementStatus == 'pending_sdo' ||
        endorsementStatus == 'pending_guidance' ||
        endorsementStatus == 'pending_pd';
  }

  String _knownStage(String? raw) =>
      const {
        'application_submitted',
        'requirements_review',
        'endorsement_review',
        'ready_for_activation',
        'scholar_activated',
      }.contains(raw)
      ? raw!
      : '';

  String _knownRequirementsStatus(String? raw) =>
      const {
        'verified',
        'rejected',
        'reupload_required',
        'missing',
        'under_review',
      }.contains(raw)
      ? raw!
      : '';

  String _knownEndorsementStatus(String? raw) =>
      const {
        'pending_sdo',
        'pending_guidance',
        'pending_pd',
        'completed',
        'rejected',
        'held',
        'major_offense',
      }.contains(raw)
      ? raw!
      : '';

  String _knownActivationStatus(String? raw) {
    if (raw == 'ready_for_activation') return 'ready';
    return const {'not_ready', 'ready', 'activated'}.contains(raw) ? raw! : '';
  }

  String _knownBlocker(String? raw) =>
      const {
        'requirements.missing',
        'requirements.reupload_required',
        'requirements.under_review',
        'requirements.rejected',
        'endorsement.grade_document_missing',
        'endorsement.held',
        'endorsement.major_offense',
        'endorsement.rejected',
      }.contains(raw)
      ? raw!
      : '';

  String? _opaqueIdentifier(String? value) {
    final text = value?.trim() ?? '';
    return text.isEmpty ? null : text;
  }

  String _displayContent(
    String? value, {
    Set<String> disallowed = const {},
    Set<String> redactedFragments = const {},
  }) {
    var text = value?.trim() ?? '';
    if (text.isEmpty || disallowed.contains(text.toLowerCase())) return '';

    text = text.replaceAll(_uuidPattern, '');
    text = text.replaceAllMapped(_isoDateTimePattern, (match) {
      final parsed = DateTime.tryParse(match.group(0) ?? '');
      return parsed == null ? '' : _dateFormat.format(parsed.toLocal());
    });
    text = text.replaceAll(_workflowCodePattern, '');
    for (final fragment in redactedFragments) {
      final normalized = fragment.trim();
      if (normalized.isEmpty) continue;
      text = text.replaceAll(
        RegExp(RegExp.escape(normalized), caseSensitive: false),
        '',
      );
    }
    text = text.replaceAll(RegExp(r'\s+'), ' ').trim();
    return text;
  }
}
