import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/models/applicant_home_presentation.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/widgets/applicant_application_status_panel.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/widgets/applicant_home_section_state.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/widgets/applicant_latest_update_section.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/widgets/applicant_openings_section.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/widgets/applicant_progress_section.dart';

class ApplicantHomeView extends StatelessWidget {
  const ApplicantHomeView({
    super.key,
    required this.state,
    required this.onRefresh,
    required this.onAction,
    required this.onViewAllOpenings,
    required this.onViewAllUpdates,
    required this.onRetryIdentity,
    required this.onRetryApplicationStatus,
    required this.onRetryDocuments,
    required this.onRetryOpenings,
    required this.onRetryLatestUpdate,
  });

  final ApplicantHomeState state;
  final RefreshCallback onRefresh;
  final ValueChanged<ApplicantHomeActionPresentation> onAction;
  final VoidCallback onViewAllOpenings;
  final VoidCallback onViewAllUpdates;
  final VoidCallback onRetryIdentity;
  final VoidCallback onRetryApplicationStatus;
  final VoidCallback onRetryDocuments;
  final VoidCallback onRetryOpenings;
  final VoidCallback onRetryLatestUpdate;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ColoredBox(
      color: theme.scaffoldBackgroundColor,
      child: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: onRefresh,
          child: ListView(
            key: const ValueKey<String>('applicant-home-scroll-view'),
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.screenHorizontal,
              AppSpacing.lg,
              AppSpacing.screenHorizontal,
              AppSizes.applicantHomeBottomClearance,
            ),
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(
                    maxWidth: AppSizes.maxContentWidth,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _ApplicantIdentityHeader(
                        section: state.identity,
                        onRetry: onRetryIdentity,
                      ),
                      const SizedBox(height: AppSpacing.section),
                      _ApplicationStatusSection(
                        section: state.applicationStatus,
                        onAction: onAction,
                        onRetry: onRetryApplicationStatus,
                      ),
                      const SizedBox(height: AppSpacing.section),
                      _ProgressStateSection(
                        status: state.applicationStatus,
                        documents: state.documents,
                        items: state.progress,
                        onAction: onAction,
                        onRetryStatus: onRetryApplicationStatus,
                        onRetryDocuments: onRetryDocuments,
                      ),
                      const SizedBox(height: AppSpacing.section),
                      ApplicantOpeningsSection(
                        section: state.openings,
                        onAction: onAction,
                        onViewAll: onViewAllOpenings,
                        onRetry: onRetryOpenings,
                      ),
                      const SizedBox(height: AppSpacing.section),
                      ApplicantLatestUpdateSection(
                        section: state.latestUpdate,
                        onAction: onAction,
                        onViewAll: onViewAllUpdates,
                        onRetry: onRetryLatestUpdate,
                      ),
                      const SizedBox(height: AppSpacing.jumbo),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ApplicantIdentityHeader extends StatelessWidget {
  const _ApplicantIdentityHeader({
    required this.section,
    required this.onRetry,
  });

  final ApplicantHomeSectionState<ApplicantHomeIdentityPresentation> section;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final identity = section.data;

    if (identity == null) {
      if (section.hasError) {
        return ApplicantHomeFailureState(
          title: 'We could not load your profile',
          message: 'Your application information is still safe.',
          onRetry: onRetry,
        );
      }
      return const ApplicantHomeLoadingState(
        label: 'Loading your Applicant Home',
      );
    }

    final displayName = identity.displayName.trim();
    final studentNumber = identity.studentNumber.trim();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (section.isStale)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: ApplicantHomeInlineNotice(
              message: 'Showing your saved profile information.',
              onRetry: onRetry,
            ),
          ),
        Text(
          'Applicant Home',
          style: theme.textTheme.labelLarge?.copyWith(
            color: theme.colorScheme.primary,
            fontWeight: FontWeight.w800,
            letterSpacing: .5,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Semantics(
          header: true,
          child: Text(
            displayName.isEmpty ? 'Welcome' : 'Welcome, $displayName',
            style: theme.textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        if (studentNumber.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Student number $studentNumber',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    );
  }
}

class _ApplicationStatusSection extends StatelessWidget {
  const _ApplicationStatusSection({
    required this.section,
    required this.onAction,
    required this.onRetry,
  });

  final ApplicantHomeSectionState<ApplicantHomeApplicationPresentation> section;
  final ValueChanged<ApplicantHomeActionPresentation> onAction;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final application = section.data;

    return ApplicantHomeSectionStateView(
      hasLoaded: section.hasLoaded,
      hasContent: application != null,
      isEmpty: section.hasLoaded && application == null,
      hasError: section.hasError,
      loadingLabel: 'Loading application status',
      emptyTitle: 'Application status is not available yet',
      emptyMessage: 'Choose a scholarship to get started.',
      errorTitle: 'Application status is unavailable',
      errorMessage: 'We could not refresh your application status.',
      onRetry: onRetry,
      child: application == null
          ? const SizedBox.shrink()
          : ApplicantApplicationStatusPanel(
              application: application,
              onAction: onAction,
            ),
    );
  }
}

class _ProgressStateSection extends StatelessWidget {
  const _ProgressStateSection({
    required this.status,
    required this.documents,
    required this.items,
    required this.onAction,
    required this.onRetryStatus,
    required this.onRetryDocuments,
  });

  final ApplicantHomeSectionState<ApplicantHomeApplicationPresentation> status;
  final ApplicantHomeSectionState<ApplicantHomeDocumentsPresentation> documents;
  final List<ApplicantHomeProgressPresentation> items;
  final ValueChanged<ApplicantHomeActionPresentation> onAction;
  final VoidCallback onRetryStatus;
  final VoidCallback onRetryDocuments;

  @override
  Widget build(BuildContext context) {
    return ApplicantHomeSectionStateView(
      hasLoaded: status.hasLoaded,
      hasContent: items.isNotEmpty,
      isEmpty: status.hasLoaded && items.isEmpty,
      hasError: status.hasError,
      loadingLabel: 'Loading application progress',
      emptyTitle: 'Progress will appear here',
      emptyMessage: 'Your steps will be shown after you begin an application.',
      errorTitle: 'Application progress is unavailable',
      errorMessage: 'We could not refresh your application progress.',
      onRetry: onRetryStatus,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (documents.hasError) ...[
            ApplicantHomeInlineNotice(
              message:
                  'Document counts could not be refreshed. Your application progress is still shown.',
              onRetry: onRetryDocuments,
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          ApplicantProgressSection(items: items, onAction: onAction),
        ],
      ),
    );
  }
}
