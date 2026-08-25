import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/models/applicant_home_presentation.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/widgets/applicant_home_section_state.dart';

class ApplicantLatestUpdateSection extends StatelessWidget {
  const ApplicantLatestUpdateSection({
    super.key,
    required this.section,
    required this.onAction,
    required this.onViewAll,
    required this.onRetry,
  });

  final ApplicantHomeSectionState<ApplicantHomeUpdatePresentation> section;
  final ValueChanged<ApplicantHomeActionPresentation> onAction;
  final VoidCallback onViewAll;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final update = section.data;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Semantics(
                header: true,
                child: Text(
                  'Latest update',
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
          hasContent: update != null,
          isEmpty: section.hasLoaded && update == null,
          hasError: section.hasError,
          loadingLabel: 'Loading the latest office update',
          emptyTitle: 'No office updates yet',
          emptyMessage: 'New, verified office updates will appear here.',
          errorTitle: 'Updates are unavailable',
          errorMessage: 'We could not refresh office updates.',
          onRetry: onRetry,
          child: update == null
              ? const SizedBox.shrink()
              : _UpdateCard(update: update, onAction: onAction),
        ),
      ],
    );
  }
}

class _UpdateCard extends StatelessWidget {
  const _UpdateCard({required this.update, required this.onAction});

  final ApplicantHomeUpdatePresentation update;
  final ValueChanged<ApplicantHomeActionPresentation> onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final statusColors = AppStatusColors.of(context);
    final publishedLabel = update.publishedLabel?.trim() ?? '';

    return Semantics(
      container: true,
      button: true,
      label: [
        update.categoryLabel,
        update.title,
        update.summary,
        if (publishedLabel.isNotEmpty) publishedLabel,
        update.action.label,
      ].join('. '),
      child: Material(
        color: theme.colorScheme.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.lg),
          side: BorderSide(color: theme.colorScheme.outlineVariant),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => onAction(update.action),
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: AppSizes.minimumTapTarget,
            ),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
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
                            color: statusColors.neutralContainer,
                            borderRadius: BorderRadius.circular(AppRadii.md),
                          ),
                          child: Icon(
                            Icons.campaign_outlined,
                            color: statusColors.onNeutralContainer,
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              update.categoryLabel,
                              style: theme.textTheme.labelMedium?.copyWith(
                                color: theme.colorScheme.primary,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xxs),
                            Text(
                              update.title,
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    update.summary,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  if (publishedLabel.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      publishedLabel,
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          update.action.label,
                          style: theme.textTheme.labelLarge?.copyWith(
                            color: theme.colorScheme.primary,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      ExcludeSemantics(
                        child: Icon(
                          Icons.arrow_forward_rounded,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
