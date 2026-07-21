import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';

/// Presents the common loading, empty, failure, and cached-refresh states used
/// by Applicant Home sections.
///
/// The widget deliberately receives display-safe copy instead of exceptions or
/// transport failures. This keeps internal error details out of both visible
/// text and the semantics tree.
class ApplicantHomeSectionStateView extends StatelessWidget {
  const ApplicantHomeSectionStateView({
    super.key,
    required this.hasLoaded,
    required this.hasContent,
    required this.isEmpty,
    required this.hasError,
    required this.loadingLabel,
    required this.emptyTitle,
    required this.emptyMessage,
    required this.errorTitle,
    required this.errorMessage,
    required this.child,
    this.onRetry,
  });

  final bool hasLoaded;
  final bool hasContent;
  final bool isEmpty;
  final bool hasError;
  final String loadingLabel;
  final String emptyTitle;
  final String emptyMessage;
  final String errorTitle;
  final String errorMessage;
  final Widget child;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    if (!hasLoaded && !hasContent && !hasError) {
      return ApplicantHomeLoadingState(label: loadingLabel);
    }

    if (hasError && !hasContent) {
      return ApplicantHomeFailureState(
        title: errorTitle,
        message: errorMessage,
        onRetry: onRetry,
      );
    }

    if (isEmpty && !hasContent) {
      return ApplicantHomeEmptyState(title: emptyTitle, message: emptyMessage);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (hasError) ...[
          ApplicantHomeInlineNotice(
            message: 'Showing saved information. $errorMessage',
            onRetry: onRetry,
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        child,
      ],
    );
  }
}

class ApplicantHomeLoadingState extends StatelessWidget {
  const ApplicantHomeLoadingState({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Semantics(
      container: true,
      liveRegion: true,
      label: label,
      child: ExcludeSemantics(
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(AppRadii.lg),
            border: Border.all(color: colors.outlineVariant),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SkeletonBar(
                widthFactor: .45,
                color: colors.surfaceContainerHighest,
              ),
              const SizedBox(height: AppSpacing.sm),
              _SkeletonBar(
                widthFactor: .9,
                color: colors.surfaceContainerHighest,
              ),
              const SizedBox(height: AppSpacing.xs),
              _SkeletonBar(
                widthFactor: .7,
                color: colors.surfaceContainerHighest,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ApplicantHomeEmptyState extends StatelessWidget {
  const ApplicantHomeEmptyState({
    super.key,
    required this.title,
    required this.message,
  });

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final statusColors = AppStatusColors.of(context);

    return Semantics(
      container: true,
      label: '$title. $message',
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(color: theme.colorScheme.outlineVariant),
        ),
        child: Column(
          children: [
            ExcludeSemantics(
              child: Container(
                width: AppSizes.minimumTapTarget,
                height: AppSizes.minimumTapTarget,
                decoration: BoxDecoration(
                  color: statusColors.neutralContainer,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.inbox_outlined,
                  color: statusColors.onNeutralContainer,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              title,
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ApplicantHomeFailureState extends StatelessWidget {
  const ApplicantHomeFailureState({
    super.key,
    required this.title,
    required this.message,
    this.onRetry,
  });

  final String title;
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final statusColors = AppStatusColors.of(context);

    return Semantics(
      container: true,
      liveRegion: true,
      label: '$title. $message',
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: statusColors.dangerContainer,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(color: statusColors.dangerOutline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ExcludeSemantics(
                  child: Icon(
                    Icons.error_outline_rounded,
                    color: statusColors.onDangerContainer,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: theme.textTheme.titleSmall?.copyWith(
                          color: statusColors.onDangerContainer,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        message,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: statusColors.onDangerContainer,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (onRetry != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: OutlinedButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Try again'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: statusColors.onDangerContainer,
                    side: BorderSide(color: statusColors.dangerOutline),
                    minimumSize: const Size(0, AppSizes.minimumTapTarget),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class ApplicantHomeInlineNotice extends StatelessWidget {
  const ApplicantHomeInlineNotice({
    super.key,
    required this.message,
    this.onRetry,
  });

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final statusColors = AppStatusColors.of(context);

    return Semantics(
      container: true,
      liveRegion: true,
      label: message,
      child: Container(
        padding: const EdgeInsetsDirectional.fromSTEB(
          AppSpacing.sm,
          AppSpacing.xs,
          AppSpacing.xs,
          AppSpacing.xs,
        ),
        decoration: BoxDecoration(
          color: statusColors.actionRequiredContainer,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(color: statusColors.actionRequiredOutline),
        ),
        child: Row(
          children: [
            ExcludeSemantics(
              child: Icon(
                Icons.info_outline_rounded,
                color: statusColors.onActionRequiredContainer,
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                message,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: statusColors.onActionRequiredContainer,
                ),
              ),
            ),
            if (onRetry != null)
              TextButton(
                onPressed: onRetry,
                style: TextButton.styleFrom(
                  foregroundColor: statusColors.onActionRequiredContainer,
                  minimumSize: const Size(0, AppSizes.minimumTapTarget),
                ),
                child: const Text('Retry'),
              ),
          ],
        ),
      ),
    );
  }
}

class _SkeletonBar extends StatelessWidget {
  const _SkeletonBar({required this.widthFactor, required this.color});

  final double widthFactor;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      widthFactor: widthFactor,
      child: Container(
        height: 14,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
      ),
    );
  }
}
