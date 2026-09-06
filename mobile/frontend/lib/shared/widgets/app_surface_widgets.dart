import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';

enum AppStatusTone { neutral, inProgress, actionRequired, success, danger, brand }

abstract final class AppSurfacePalette {
  static bool isDark(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;

  static Color background(BuildContext context) => isDark(context)
      ? AppColors.applicantDarkBackground
      : AppColors.applicantLightBackground;

  static Color surface(BuildContext context) => isDark(context)
      ? AppColors.applicantDarkSurface
      : AppColors.applicantLightSurface;

  static Color surfaceMuted(BuildContext context) => isDark(context)
      ? AppColors.applicantDarkSurfaceMuted
      : AppColors.applicantLightSurfaceMuted;

  static Color outline(BuildContext context) => isDark(context)
      ? AppColors.applicantDarkOutline
      : AppColors.applicantLightOutline;

  static Color text(BuildContext context) => isDark(context)
      ? AppColors.applicantDarkText
      : AppColors.applicantLightText;

  static Color mutedText(BuildContext context) => isDark(context)
      ? AppColors.applicantDarkTextMuted
      : AppColors.applicantLightTextMuted;
}

class AppSurfaceCard extends StatelessWidget {
  const AppSurfaceCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.lg),
    this.margin = EdgeInsets.zero,
    this.onTap,
    this.backgroundColor,
    this.borderColor,
    this.radius = AppRadii.lg,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final VoidCallback? onTap;
  final Color? backgroundColor;
  final Color? borderColor;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final isDark = AppSurfacePalette.isDark(context);
    final borderRadius = BorderRadius.circular(radius);

    final shape = RoundedRectangleBorder(
      borderRadius: borderRadius,
      side: BorderSide(
        color: borderColor ?? AppSurfacePalette.outline(context),
      ),
    );

    final content = Padding(
      padding: padding,
      child: child,
    );

    final card = Material(
      color: backgroundColor ?? AppSurfacePalette.surface(context),
      surfaceTintColor: Colors.transparent,
      elevation: isDark ? 0 : 1,
      shadowColor: const Color(0x18000000),
      shape: shape,
      clipBehavior: Clip.antiAlias,
      child: onTap == null
          ? content
          : InkWell(
              onTap: onTap,
              child: content,
            ),
    );

    if (margin == EdgeInsets.zero) return card;
    return Padding(padding: margin, child: card);
  }
}

class AppIconTile extends StatelessWidget {
  const AppIconTile({
    super.key,
    required this.icon,
    this.accent = AppColors.gold,
    this.size = AppSizes.cardIcon,
  });

  final IconData icon;
  final Color accent;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: accent.withValues(
          alpha: AppSurfacePalette.isDark(context) ? 0.18 : 0.12,
        ),
        borderRadius: AppRadii.control,
      ),
      child: Icon(icon, color: accent, size: size * 0.52),
    );
  }
}

class AppStatusCapsule extends StatelessWidget {
  const AppStatusCapsule({
    super.key,
    required this.label,
    this.tone = AppStatusTone.neutral,
    this.compact = false,
  });

  final String label;
  final AppStatusTone tone;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = AppStatusColors.of(context);
    final (background, foreground, outline) = switch (tone) {
      AppStatusTone.neutral => (
          colors.neutralContainer,
          colors.onNeutralContainer,
          colors.neutralOutline,
        ),
      AppStatusTone.inProgress => (
          colors.inProgressContainer,
          colors.onInProgressContainer,
          colors.inProgressOutline,
        ),
      AppStatusTone.actionRequired => (
          colors.actionRequiredContainer,
          colors.onActionRequiredContainer,
          colors.actionRequiredOutline,
        ),
      AppStatusTone.success => (
          colors.successContainer,
          colors.onSuccessContainer,
          colors.successOutline,
        ),
      AppStatusTone.danger => (
          colors.dangerContainer,
          colors.onDangerContainer,
          colors.dangerOutline,
        ),
      AppStatusTone.brand => (
          AppColors.gold.withValues(
            alpha: AppSurfacePalette.isDark(context) ? 0.20 : 0.16,
          ),
          AppSurfacePalette.isDark(context)
              ? AppColors.gold
              : AppColors.darkBrown,
          AppColors.gold.withValues(alpha: 0.46),
        ),
    };

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? AppSpacing.sm : AppSpacing.md,
        vertical: compact ? AppSpacing.xs : AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadii.status,
        border: Border.all(color: outline),
      ),
      child: Text(
        label.toUpperCase(),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: foreground,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.35,
            ),
      ),
    );
  }
}

class AppSectionHeading extends StatelessWidget {
  const AppSectionHeading({
    super.key,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: AppSurfacePalette.text(context),
                      fontWeight: FontWeight.w800,
                    ),
              ),
              if (subtitle?.trim().isNotEmpty == true) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  subtitle!.trim(),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppSurfacePalette.mutedText(context),
                      ),
                ),
              ],
            ],
          ),
        ),
        if (actionLabel != null && onAction != null)
          TextButton(onPressed: onAction, child: Text(actionLabel!)),
      ],
    );
  }
}
