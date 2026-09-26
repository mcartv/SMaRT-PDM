import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/models/applicant_home_presentation.dart';

class ApplicantApplicationStatusPanel extends StatelessWidget {
  const ApplicantApplicationStatusPanel({
    super.key,
    required this.application,
    required this.onAction,
  });

  final ApplicantHomeApplicationPresentation application;
  final ValueChanged<ApplicantHomeActionPresentation> onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = _paletteFor(context, application.tone);
    final stepLabel = application.stepLabel?.trim() ?? '';
    final surface = theme.colorScheme.surface;
    final textColor = theme.colorScheme.onSurface;

    return Semantics(
      container: true,
      label: application.semanticLabel,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: surface,
          borderRadius: BorderRadius.circular(AppRadii.xl),
          border: Border.all(color: palette.outline.withValues(alpha: .72)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                ExcludeSemantics(
                  child: Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: palette.container,
                      borderRadius: AppRadii.control,
                    ),
                    child: Icon(
                      palette.icon,
                      color: palette.foreground,
                      size: 22,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'APPLICATION STATUS',
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: textColor,
                      fontWeight: FontWeight.w900,
                      letterSpacing: .65,
                    ),
                  ),
                ),
                if (stepLabel.isNotEmpty)
                  Semantics(
                    label: 'Application progress: $stepLabel',
                    child: Container(
                      constraints: const BoxConstraints(maxWidth: 150),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: palette.container,
                        borderRadius: AppRadii.status,
                        border: Border.all(
                          color: palette.outline.withValues(alpha: .75),
                        ),
                      ),
                      child: Text(
                        stepLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: palette.foreground,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: palette.container,
                borderRadius: AppRadii.control,
                border: Border.all(color: palette.outline),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Current status',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: palette.foreground.withValues(alpha: .8),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxs),
                  Semantics(
                    header: true,
                    child: Text(
                      application.title,
                      style: theme.textTheme.titleLarge?.copyWith(
                        color: palette.foreground,
                        fontWeight: FontWeight.w900,
                        height: 1.2,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    application.description,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: palette.foreground.withValues(alpha: .9),
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => onAction(application.primaryAction),
                icon: const Icon(Icons.arrow_forward_rounded, size: 20),
                label: Text(application.primaryAction.label),
                style: FilledButton.styleFrom(
                  backgroundColor: palette.foreground,
                  foregroundColor: palette.container,
                  minimumSize: const Size.fromHeight(52),
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: AppRadii.control,
                  ),
                  textStyle: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

_TonePalette _paletteFor(BuildContext context, ApplicantHomeTone tone) {
  final colors = AppStatusColors.of(context);
  return switch (tone) {
    ApplicantHomeTone.neutral => _TonePalette(
      container: colors.neutralContainer,
      foreground: colors.onNeutralContainer,
      outline: colors.neutralOutline,
      icon: Icons.info_outline_rounded,
    ),
    ApplicantHomeTone.inProgress => _TonePalette(
      container: colors.inProgressContainer,
      foreground: colors.onInProgressContainer,
      outline: colors.inProgressOutline,
      icon: Icons.pending_actions_rounded,
    ),
    ApplicantHomeTone.actionRequired => _TonePalette(
      container: colors.actionRequiredContainer,
      foreground: colors.onActionRequiredContainer,
      outline: colors.actionRequiredOutline,
      icon: Icons.priority_high_rounded,
    ),
    ApplicantHomeTone.success => _TonePalette(
      container: colors.successContainer,
      foreground: colors.onSuccessContainer,
      outline: colors.successOutline,
      icon: Icons.check_circle_outline_rounded,
    ),
    ApplicantHomeTone.danger => _TonePalette(
      container: colors.dangerContainer,
      foreground: colors.onDangerContainer,
      outline: colors.dangerOutline,
      icon: Icons.error_outline_rounded,
    ),
  };
}

class _TonePalette {
  const _TonePalette({
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
