import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/models/applicant_home_presentation.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/widgets/applicant_home_section_state.dart';

class ApplicantOpeningsSection extends StatelessWidget {
  const ApplicantOpeningsSection({
    super.key,
    required this.section,
    required this.onAction,
    required this.onViewAll,
    required this.onRetry,
  });

  final ApplicantHomeSectionState<ApplicantHomeOpeningsPresentation> section;
  final ValueChanged<ApplicantHomeActionPresentation> onAction;
  final VoidCallback onViewAll;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final openings =
        section.data?.items.take(3).toList(growable: false) ??
        const <ApplicantHomeOpeningPresentation>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Semantics(
                header: true,
                child: Text(
                  'Scholarship openings',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            TextButton(
              onPressed: onViewAll,
              style: TextButton.styleFrom(
                minimumSize: const Size(0, AppSizes.minimumTapTarget),
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
              ),
              child: const Text('View all'),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        ApplicantHomeSectionStateView(
          hasLoaded: section.hasLoaded,
          hasContent: openings.isNotEmpty,
          isEmpty: section.hasLoaded && openings.isEmpty,
          hasError: section.hasError,
          loadingLabel: 'Loading scholarship openings',
          emptyTitle: 'No openings right now',
          emptyMessage:
              'New scholarship opportunities will appear here when available.',
          errorTitle: 'Openings are unavailable',
          errorMessage: 'We could not refresh scholarship openings.',
          onRetry: onRetry,
          child: Column(
            children: [
              for (var index = 0; index < openings.length; index++) ...[
                _OpeningCard(opening: openings[index], onAction: onAction),
                if (index != openings.length - 1)
                  const SizedBox(height: AppSpacing.sm),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _OpeningCard extends StatelessWidget {
  const _OpeningCard({required this.opening, required this.onAction});

  final ApplicantHomeOpeningPresentation opening;
  final ValueChanged<ApplicantHomeActionPresentation> onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final statusColors = AppStatusColors.of(context);
    final period = opening.applicationPeriod?.trim() ?? '';

    return Semantics(
      container: true,
      label: [
        opening.title,
        opening.programName,
        if (period.isNotEmpty) period,
        opening.actionLabel,
      ].join('. '),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(color: theme.colorScheme.outlineVariant),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ExcludeSemantics(
                  child: Container(
                    width: AppSizes.cardIcon,
                    height: AppSizes.cardIcon,
                    decoration: BoxDecoration(
                      color: statusColors.inProgressContainer,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                    ),
                    child: Icon(
                      Icons.school_outlined,
                      color: statusColors.onInProgressContainer,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        opening.title,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        opening.programName,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (period.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ExcludeSemantics(
                    child: Icon(
                      Icons.calendar_today_outlined,
                      size: 18,
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      period,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => onAction(opening.action),
                icon: Icon(
                  opening.canApply
                      ? Icons.arrow_forward_rounded
                      : Icons.visibility_outlined,
                ),
                label: Text(opening.actionLabel),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(AppSizes.minimumTapTarget),
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
