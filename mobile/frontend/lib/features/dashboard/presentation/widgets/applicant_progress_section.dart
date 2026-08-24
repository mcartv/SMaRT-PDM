import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/models/applicant_home_presentation.dart';

class ApplicantProgressSection extends StatelessWidget {
  const ApplicantProgressSection({
    super.key,
    required this.items,
    required this.onAction,
  });

  final List<ApplicantHomeProgressPresentation> items;
  final ValueChanged<ApplicantHomeActionPresentation> onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(
            'Application progress',
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Container(
          decoration: BoxDecoration(
            color: theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(AppRadii.lg),
            border: Border.all(color: theme.colorScheme.outlineVariant),
          ),
          child: Column(
            children: [
              for (var index = 0; index < items.length; index++) ...[
                _ProgressRow(item: items[index], onAction: onAction),
                if (index != items.length - 1)
                  Divider(
                    height: 1,
                    indent: AppSpacing.md,
                    endIndent: AppSpacing.md,
                    color: theme.colorScheme.outlineVariant,
                  ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _ProgressRow extends StatelessWidget {
  const _ProgressRow({required this.item, required this.onAction});

  final ApplicantHomeProgressPresentation item;
  final ValueChanged<ApplicantHomeActionPresentation> onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = _progressPaletteFor(context, item.tone);
    final description = item.description?.trim() ?? '';
    final semanticDescription = description.isEmpty ? '' : '. $description';

    return Semantics(
      container: true,
      label: '${item.label}. Status: ${item.status}$semanticDescription',
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ExcludeSemantics(
              child: Container(
                width: AppSizes.minimumTapTarget,
                height: AppSizes.minimumTapTarget,
                decoration: BoxDecoration(
                  color: palette.container,
                  shape: BoxShape.circle,
                  border: Border.all(color: palette.outline),
                ),
                child: Icon(palette.icon, color: palette.foreground),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.label,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    item.status,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: palette.foreground,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (description.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      description,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                  if (item.action case final action?) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: TextButton(
                        onPressed: () => onAction(action),
                        style: TextButton.styleFrom(
                          minimumSize: const Size(0, AppSizes.minimumTapTarget),
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.sm,
                          ),
                        ),
                        child: Text(action.label),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

_ProgressPalette _progressPaletteFor(
  BuildContext context,
  ApplicantHomeTone tone,
) {
  final colors = AppStatusColors.of(context);
  return switch (tone) {
    ApplicantHomeTone.neutral => _ProgressPalette(
      container: colors.neutralContainer,
      foreground: colors.onNeutralContainer,
      outline: colors.neutralOutline,
      icon: Icons.radio_button_unchecked_rounded,
    ),
    ApplicantHomeTone.inProgress => _ProgressPalette(
      container: colors.inProgressContainer,
      foreground: colors.onInProgressContainer,
      outline: colors.inProgressOutline,
      icon: Icons.schedule_rounded,
    ),
    ApplicantHomeTone.actionRequired => _ProgressPalette(
      container: colors.actionRequiredContainer,
      foreground: colors.onActionRequiredContainer,
      outline: colors.actionRequiredOutline,
      icon: Icons.priority_high_rounded,
    ),
    ApplicantHomeTone.success => _ProgressPalette(
      container: colors.successContainer,
      foreground: colors.onSuccessContainer,
      outline: colors.successOutline,
      icon: Icons.check_rounded,
    ),
    ApplicantHomeTone.danger => _ProgressPalette(
      container: colors.dangerContainer,
      foreground: colors.onDangerContainer,
      outline: colors.dangerOutline,
      icon: Icons.error_outline_rounded,
    ),
  };
}

class _ProgressPalette {
  const _ProgressPalette({
    required this.container,
    required this.foreground,
    required this.outline,
    required this.icon,
  });

  final Color container;
  final Color foreground;
  final Color outline;
  final IconData icon;
}
