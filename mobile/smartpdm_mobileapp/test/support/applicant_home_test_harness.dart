import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:smartpdm_mobileapp/app/theme/applicant_home_theme.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/models/applicant_home_presentation.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/widgets/applicant_home_view.dart';

const applicantHomePrivateUuid = 'bb1aded0-83d5-4985-9801-8dd8d461a06a';
const applicantHomePrivateIsoDate = '2026-07-13T10:30:00Z';
const applicantHomePrivateWorkflowCode = 'requirements.missing';
const applicantHomePrivateReferenceType = 'private_reference_type';

class ApplicantHomeTestHarness extends StatelessWidget {
  const ApplicantHomeTestHarness({
    super.key,
    required this.state,
    this.themeMode = ThemeMode.light,
    this.parentTextScaler = const TextScaler.linear(.7),
    this.onRefresh,
    this.onAction,
    this.onViewAllOpenings,
    this.onViewAllUpdates,
    this.onRetryIdentity,
    this.onRetryApplicationStatus,
    this.onRetryDocuments,
    this.onRetryOpenings,
    this.onRetryLatestUpdate,
  });

  final ApplicantHomeState state;
  final ThemeMode themeMode;
  final TextScaler parentTextScaler;
  final RefreshCallback? onRefresh;
  final ValueChanged<ApplicantHomeActionPresentation>? onAction;
  final VoidCallback? onViewAllOpenings;
  final VoidCallback? onViewAllUpdates;
  final VoidCallback? onRetryIdentity;
  final VoidCallback? onRetryApplicationStatus;
  final VoidCallback? onRetryDocuments;
  final VoidCallback? onRetryOpenings;
  final VoidCallback? onRetryLatestUpdate;

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      key: const ValueKey<String>('applicant-home-golden-boundary'),
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          brightness: Brightness.light,
          useMaterial3: true,
          fontFamily: 'Roboto',
        ),
        darkTheme: ThemeData(
          brightness: Brightness.dark,
          useMaterial3: true,
          fontFamily: 'Roboto',
        ),
        themeMode: themeMode,
        home: Builder(
          builder: (context) {
            // This deliberately simulates the conflicting MediaQuery installed
            // by the app shell. ApplicantHomeThemeScope must replace only its
            // scaler with the real platform value.
            final conflictingMedia = MediaQuery.of(
              context,
            ).copyWith(textScaler: parentTextScaler);

            return MediaQuery(
              data: conflictingMedia,
              child: ApplicantHomeThemeScope(
                child: Scaffold(
                  body: ApplicantHomeView(
                    state: state,
                    onRefresh: onRefresh ?? _noopRefresh,
                    onAction: onAction ?? _noopAction,
                    onViewAllOpenings: onViewAllOpenings ?? _noop,
                    onViewAllUpdates: onViewAllUpdates ?? _noop,
                    onRetryIdentity: onRetryIdentity ?? _noop,
                    onRetryApplicationStatus: onRetryApplicationStatus ?? _noop,
                    onRetryDocuments: onRetryDocuments ?? _noop,
                    onRetryOpenings: onRetryOpenings ?? _noop,
                    onRetryLatestUpdate: onRetryLatestUpdate ?? _noop,
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

Future<void> pumpApplicantHome(
  WidgetTester tester, {
  required ApplicantHomeState state,
  double width = 390,
  double height = 844,
  double platformTextScale = 1,
  ThemeMode themeMode = ThemeMode.light,
  TextScaler parentTextScaler = const TextScaler.linear(.7),
  RefreshCallback? onRefresh,
  ValueChanged<ApplicantHomeActionPresentation>? onAction,
  VoidCallback? onViewAllOpenings,
  VoidCallback? onViewAllUpdates,
  VoidCallback? onRetryIdentity,
  VoidCallback? onRetryApplicationStatus,
  VoidCallback? onRetryDocuments,
  VoidCallback? onRetryOpenings,
  VoidCallback? onRetryLatestUpdate,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = Size(width, height);
  tester.platformDispatcher.textScaleFactorTestValue = platformTextScale;

  await tester.pumpWidget(
    ApplicantHomeTestHarness(
      state: state,
      themeMode: themeMode,
      parentTextScaler: parentTextScaler,
      onRefresh: onRefresh,
      onAction: onAction,
      onViewAllOpenings: onViewAllOpenings,
      onViewAllUpdates: onViewAllUpdates,
      onRetryIdentity: onRetryIdentity,
      onRetryApplicationStatus: onRetryApplicationStatus,
      onRetryDocuments: onRetryDocuments,
      onRetryOpenings: onRetryOpenings,
      onRetryLatestUpdate: onRetryLatestUpdate,
    ),
  );
  await tester.pump();
}

void resetApplicantHomeTestView(WidgetTester tester) {
  tester.platformDispatcher.clearTextScaleFactorTestValue();
  tester.view.resetPhysicalSize();
  tester.view.resetDevicePixelRatio();
}

ApplicantHomeState populatedApplicantHomeState({
  ApplicantHomeStage stage = ApplicantHomeStage.requirements,
  ApplicantHomeTone tone = ApplicantHomeTone.actionRequired,
  String title = 'Upload your remaining documents',
  String description =
      'Complete the remaining requirements so the review team can continue '
      'checking your scholarship application.',
  String? stepLabel = 'Step 2 of 4',
  String actionLabel = 'Open documents',
  ApplicantHomeActionTarget actionTarget = ApplicantHomeActionTarget.documents,
  bool longContent = false,
  bool isRefreshing = false,
  ApplicantHomeSectionFailure? identityFailure,
  ApplicantHomeSectionFailure? applicationFailure,
  ApplicantHomeSectionFailure? documentsFailure,
  ApplicantHomeSectionFailure? openingsFailure,
  ApplicantHomeSectionFailure? latestUpdateFailure,
}) {
  final displayName = longContent
      ? 'Alexandria Maria de los Santos Villanueva-Cruz'
      : 'Teresa Tolentino';
  final applicationTitle = longContent
      ? 'Upload the remaining scholarship documents requested by the review '
            'team'
      : title;
  final applicationDescription = longContent
      ? 'Your application is safe. Complete each outstanding requirement and '
            'review every document carefully before sending it to the '
            'scholarship office for the next stage.'
      : description;

  return ApplicantHomeState(
    identity: ApplicantHomeSectionState(
      data: ApplicantHomeIdentityPresentation(
        displayName: displayName,
        studentNumber: 'PDM-2026-001001',
        hasScholarAccess: false,
      ),
      isLoading: isRefreshing,
      hasLoaded: true,
      failure: identityFailure,
    ),
    applicationStatus: ApplicantHomeSectionState(
      data: ApplicantHomeApplicationPresentation(
        stage: stage,
        title: applicationTitle,
        description: applicationDescription,
        stepLabel: stepLabel,
        semanticLabel:
            '$applicationTitle. ${stepLabel ?? ''}. $applicationDescription',
        tone: tone,
        primaryAction: ApplicantHomeActionPresentation(
          label: longContent
              ? 'Review all outstanding scholarship requirements'
              : actionLabel,
          target: actionTarget,
          openingId: applicantHomePrivateIsoDate,
          applicationId: applicantHomePrivateUuid,
        ),
      ),
      isLoading: isRefreshing,
      hasLoaded: true,
      failure: applicationFailure,
    ),
    documents: ApplicantHomeSectionState(
      data: const ApplicantHomeDocumentsPresentation(
        uploadedCount: 1,
        requiredCount: 4,
        missingCount: 3,
      ),
      isLoading: isRefreshing,
      hasLoaded: true,
      failure: documentsFailure,
    ),
    openings: ApplicantHomeSectionState(
      data: ApplicantHomeOpeningsPresentation(
        items: _openings(longContent: longContent),
        hasSavedDraft: false,
        draftOpeningId: applicantHomePrivateReferenceType,
        draftApplicationId: applicantHomePrivateWorkflowCode,
      ),
      isLoading: isRefreshing,
      hasLoaded: true,
      failure: openingsFailure,
    ),
    latestUpdate: ApplicantHomeSectionState(
      data: ApplicantHomeUpdatePresentation(
        title: longContent
            ? 'Scholarship application review schedules and documentary '
                  'requirements have been updated'
            : 'Document review schedule updated',
        summary: longContent
            ? 'Applicants should review the revised schedule and make sure '
                  'every required document is clear, complete, and submitted '
                  'before the stated deadline.'
            : 'Review the revised schedule before uploading your requirements.',
        categoryLabel: 'OFFICE UPDATE',
        publishedLabel: 'Published 13 Jul 2026',
        action: const ApplicantHomeActionPresentation(
          label: 'Read latest update',
          target: ApplicantHomeActionTarget.notifications,
          openingId: applicantHomePrivateReferenceType,
          applicationId: applicantHomePrivateIsoDate,
        ),
      ),
      isLoading: isRefreshing,
      hasLoaded: true,
      failure: latestUpdateFailure,
    ),
    progress: [
      ApplicantHomeProgressPresentation(
        label: 'Requirements',
        status: 'Documents needed',
        description: longContent
            ? 'Three required documents still need to be uploaded and checked '
                  'for readability.'
            : '3 documents remaining',
        tone: ApplicantHomeTone.actionRequired,
        action: const ApplicantHomeActionPresentation(
          label: 'Review documents',
          target: ApplicantHomeActionTarget.documents,
          applicationId: applicantHomePrivateUuid,
        ),
      ),
      ApplicantHomeProgressPresentation(
        label: 'Endorsement',
        status: 'Not started',
        description: longContent
            ? 'Office endorsement begins after every required document passes '
                  'the requirements review.'
            : 'Begins after document review',
        tone: ApplicantHomeTone.neutral,
      ),
      const ApplicantHomeProgressPresentation(
        label: 'Activation',
        status: 'Waiting for prior steps',
        description: 'Available after endorsement',
        tone: ApplicantHomeTone.neutral,
      ),
    ],
    isRefreshing: isRefreshing,
  );
}

ApplicantHomeState noApplicationApplicantHomeState() {
  return populatedApplicantHomeState(
    stage: ApplicantHomeStage.noApplication,
    tone: ApplicantHomeTone.neutral,
    title: 'Start your scholarship application',
    description:
        'Explore the current scholarship openings and choose one that fits.',
    stepLabel: null,
    actionLabel: 'View scholarships',
    actionTarget: ApplicantHomeActionTarget.scholarships,
  ).copyWith(
    documents: const ApplicantHomeSectionState(data: null, hasLoaded: true),
    progress: const <ApplicantHomeProgressPresentation>[],
  );
}

ApplicantHomeState underReviewApplicantHomeState() {
  return populatedApplicantHomeState(
    stage: ApplicantHomeStage.requirements,
    tone: ApplicantHomeTone.inProgress,
    title: 'Documents are being reviewed',
    description:
        'The scholarship office is reviewing the documents you submitted.',
    actionLabel: 'View application status',
    actionTarget: ApplicantHomeActionTarget.status,
  );
}

ApplicantHomeState activatedApplicantHomeState() {
  final base = populatedApplicantHomeState(
    stage: ApplicantHomeStage.active,
    tone: ApplicantHomeTone.success,
    title: 'Your scholarship is active',
    description: 'Your application completed all required review stages.',
    stepLabel: 'Step 4 of 4',
    actionLabel: 'View application status',
    actionTarget: ApplicantHomeActionTarget.status,
  );

  return base.copyWith(
    progress: const [
      ApplicantHomeProgressPresentation(
        label: 'Requirements',
        status: 'Complete',
        tone: ApplicantHomeTone.success,
      ),
      ApplicantHomeProgressPresentation(
        label: 'Endorsement',
        status: 'Complete',
        tone: ApplicantHomeTone.success,
      ),
      ApplicantHomeProgressPresentation(
        label: 'Activation',
        status: 'Active scholar',
        tone: ApplicantHomeTone.success,
      ),
    ],
  );
}

ApplicantHomeState partialErrorApplicantHomeState() {
  return populatedApplicantHomeState(
    openingsFailure: ApplicantHomeSectionFailure.unavailable,
    latestUpdateFailure: ApplicantHomeSectionFailure.unavailable,
  ).copyWith(
    latestUpdate: const ApplicantHomeSectionState(
      hasLoaded: true,
      failure: ApplicantHomeSectionFailure.unavailable,
    ),
  );
}

List<ApplicantHomeOpeningPresentation> _openings({required bool longContent}) {
  return List<ApplicantHomeOpeningPresentation>.generate(4, (index) {
    final number = index + 1;
    return ApplicantHomeOpeningPresentation(
      openingId: index == 0
          ? applicantHomePrivateUuid
          : '$applicantHomePrivateReferenceType-$number',
      title: longContent
          ? 'Community Leadership and Provincial Development Scholarship '
                'Opening $number'
          : 'Genmart Scholarship Program $number',
      programName: longContent
          ? 'Student Assistance and Community Development Program'
          : 'Genmart',
      applicationPeriod: 'Applications close 31 Jul 2026',
      canApply: true,
      actionLabel: 'Review opening',
      action: ApplicantHomeActionPresentation(
        label: 'Review opening',
        target: ApplicantHomeActionTarget.scholarships,
        openingId: index == 0
            ? applicantHomePrivateUuid
            : applicantHomePrivateReferenceType,
        applicationId: applicantHomePrivateWorkflowCode,
      ),
    );
  });
}

Future<void> _noopRefresh() async {}
void _noopAction(ApplicantHomeActionPresentation _) {}
void _noop() {}
