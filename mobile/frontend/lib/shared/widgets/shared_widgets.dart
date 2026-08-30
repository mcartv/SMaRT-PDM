import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';

class AppHeader extends StatelessWidget {
  final String subtitle;
  final VoidCallback? onBack;

  const AppHeader({super.key, required this.subtitle, this.onBack});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark
        ? AppColors.applicantDarkText
        : AppColors.darkBrown;
    final backSurface = isDark
        ? AppColors.applicantDarkSurfaceMuted
        : const Color(0xFFF8F2E7);

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
                borderRadius: BorderRadius.circular(18),
                child: Container(
                  width: compact ? 40 : 46,
                  height: compact ? 40 : 46,
                  decoration: BoxDecoration(
                    color: backSurface,
                    borderRadius: BorderRadius.circular(16),
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
                    fontSize: compact ? 21 : 25,
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inactiveColor = isDark
        ? AppColors.applicantDarkTextMuted.withValues(alpha: 0.52)
        : const Color(0xFFDDD4C6);
    final inactiveSurface = isDark
        ? AppColors.applicantDarkSurfaceMuted
        : const Color(0xFFF9F4EA);
    final currentTextColor = isDark
        ? AppColors.applicantDarkText
        : AppColors.darkBrown;

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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final outlineColor = isDark
        ? const Color(0xFF665E57)
        : const Color(0xFFD2D2D2);
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: isDark
            ? AppColors.applicantDarkText
            : AppColors.darkBrown,
        side: BorderSide(color: outlineColor, width: 1),
        minimumSize: const Size(0, 56),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
        backgroundColor: isDark
            ? AppColors.applicantDarkSurfaceMuted
            : const Color(0xFFFFFBF1),
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
        disabledBackgroundColor: const Color(0xFFF0D8A0),
        disabledForegroundColor: AppColors.darkBrown.withValues(alpha: 0.55),
        foregroundColor: AppColors.darkBrown,
        minimumSize: const Size(0, 56),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
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
        minimumSize: const Size(0, 56),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
        elevation: 0,
      ),
      child: Text(
        label,
        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
      ),
    );
  }
}
