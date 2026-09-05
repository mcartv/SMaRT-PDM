import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';

class AppHeader extends StatelessWidget {
  final String subtitle;
  final VoidCallback? onBack;

  const AppHeader({super.key, required this.subtitle, this.onBack});

  @override
  Widget build(BuildContext context) {
    final textColor = AppSurfacePalette.text(context);
    final backSurface = AppSurfacePalette.surfaceMuted(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 360;
        return Padding(
          padding: EdgeInsets.fromLTRB(
            compact ? 12 : 18,
            14,
            compact ? 12 : 18,
            10,
          ),
          child: Row(
            children: [
              InkWell(
                onTap: onBack,
                borderRadius: AppRadii.control,
                child: Container(
                  width: AppSizes.minimumTapTarget,
                  height: AppSizes.minimumTapTarget,
                  decoration: BoxDecoration(
                    color: backSurface,
                    borderRadius: AppRadii.control,
                  ),
                  child: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  subtitle,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    height: 1.1,
                    color: textColor,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              SizedBox(width: compact ? 36 : 42),
            ],
          ),
        );
      },
    );
  }
}

class StepIndicator extends StatelessWidget {
  final int currentStep;
  final List<String> labels;

  const StepIndicator({
    super.key,
    required this.currentStep,
    required this.labels,
  });

  @override
  Widget build(BuildContext context) {
    final inactiveColor = AppSurfacePalette.mutedText(context).withValues(alpha: 0.58);
    final inactiveSurface = AppSurfacePalette.surfaceMuted(context);
    final currentTextColor = AppSurfacePalette.text(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 340;
        final circleSize = compact ? 30.0 : 36.0;
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(labels.length, (index) {
            final isActive = index <= currentStep;
            final isCurrent = index == currentStep;
            return Expanded(
              child: Column(
                children: [
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      if (index != labels.length - 1)
                        Positioned(
                          left: constraints.maxWidth / (labels.length * 2),
                          right: -constraints.maxWidth / (labels.length * 2),
                          child: Container(
                            height: 3,
                            color: isActive
                                ? const Color(0xFFF0C86B)
                                : inactiveColor,
                          ),
                        ),
                      Container(
                        width: circleSize,
                        height: circleSize,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isActive ? AppColors.gold : inactiveSurface,
                          border: Border.all(
                            color: isCurrent ? AppColors.gold : inactiveColor,
                            width: isCurrent ? 2 : 1.4,
                          ),
                          boxShadow: isCurrent
                              ? [
                                  BoxShadow(
                                    color: AppColors.gold.withValues(
                                      alpha: 0.25,
                                    ),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                                  ),
                                ]
                              : null,
                        ),
                        child: Center(
                          child: Text(
                            '${index + 1}',
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(
                                  color: isActive
                                      ? AppColors.darkBrown
                                      : inactiveColor,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: compact ? 6 : 8),
                  Text(
                    labels[index],
                    maxLines: 1,
                    overflow: TextOverflow.fade,
                    softWrap: false,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: isCurrent ? currentTextColor : inactiveColor,
                      fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w500,
                      fontSize: compact ? 10 : 12,
                    ),
                  ),
                ],
              ),
            );
          }),
        );
      },
    );
  }
}

class GhostButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  final Widget? icon;

  const GhostButton({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final outlineColor = AppSurfacePalette.outline(context);
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: AppSurfacePalette.text(context),
        side: BorderSide(color: outlineColor, width: 1),
        minimumSize: const Size(0, 52),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: AppRadii.control),
        backgroundColor: AppSurfacePalette.surfaceMuted(context),
      ),
      child: icon == null
          ? Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                icon!,
                const SizedBox(width: 8),
                Text(
                  label,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
    );
  }
}

class NavyButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;

  const NavyButton({super.key, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onTap,
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.gold,
        disabledBackgroundColor: AppSurfacePalette.outline(context),
        disabledForegroundColor: AppSurfacePalette.mutedText(context),
        foregroundColor: AppColors.darkBrown,
        minimumSize: const Size(0, 52),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: AppRadii.control),
        elevation: 0,
      ),
      child: Text(
        label,
        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
      ),
    );
  }
}

class GoldButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const GoldButton({super.key, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onTap,
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.gold,
        foregroundColor: AppColors.darkBrown,
        minimumSize: const Size(0, 52),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: AppRadii.control),
        elevation: 0,
      ),
      child: Text(
        label,
        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
      ),
    );
  }
}
