import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';

class IntakePalette {
  static const Color page = Color(0xFFF8F2E8);
  static const Color surface = Colors.white;
  static const Color surfaceTint = Color(0xFFFFFBF2);
  static const Color border = Color(0xFFF1DEC1);
  static const Color mutedBorder = Color(0xFFE9DED2);
  static const Color highlight = Color(0xFFFFEFC4);
  static const Color success = Color(0xFF3DBE5A);
  static const Color warning = Color(0xFFFFF6E4);
  static const Color warningIcon = Color(0xFFF4AF13);
  static const Color text = AppColors.darkBrown;
  static const Color subtext = AppColors.brown;
}

class IntakeLayout {
  const IntakeLayout._();

  static const double compactBreakpoint = 360;
  static const double twoColumnBreakpoint = 560;
  static const double contentMaxWidth = 760;

  static bool isCompact(double width) => width < compactBreakpoint;

  static bool isWide(double width) => width >= twoColumnBreakpoint;

  static double horizontalPadding(double width) {
    if (width < compactBreakpoint) return 12;
    if (width < 430) return 16;
    if (width < twoColumnBreakpoint) return 20;
    return 24;
  }

  static double sectionGap(double width) => isCompact(width) ? 16 : 20;
}

bool intakeIsDark(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark;

Color intakePageColor(BuildContext context) => AppSurfacePalette.background(context);

Color intakeSurfaceColor(BuildContext context) => AppSurfacePalette.surface(context);

Color intakeSurfaceTintColor(BuildContext context) => AppSurfacePalette.surfaceMuted(context);

Color intakeBorderColor(BuildContext context) => AppSurfacePalette.outline(context);

Color intakeMutedBorderColor(BuildContext context) =>
    AppSurfacePalette.outline(context).withValues(alpha: 0.82);

Color intakeTextColor(BuildContext context) => AppSurfacePalette.text(context);

Color intakeSubtextColor(BuildContext context) =>
    AppSurfacePalette.mutedText(context);

Color intakeWarningColor(BuildContext context) => intakeIsDark(context)
    ? AppColors.applicantDarkSurfaceMuted
    : IntakePalette.warning;

class IntakeSectionHeader extends StatelessWidget {
  const IntakeSectionHeader({
    super.key,
    required this.title,
    this.icon,
    this.bottomSpacing = 20,
  });

  final String title;
  final IconData? icon;
  final double bottomSpacing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: bottomSpacing),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                AppIconTile(icon: icon!, size: AppSizes.cardIcon),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: intakeTextColor(context),
                    letterSpacing: 0.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            height: 3,
            width: double.infinity,
            decoration: BoxDecoration(
              color: AppColors.gold,
              borderRadius: AppRadii.status,
            ),
          ),
        ],
      ),
    );
  }
}

class IntakeCard extends StatelessWidget {
  const IntakeCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.margin = EdgeInsets.zero,
    this.backgroundColor,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = IntakeLayout.isCompact(constraints.maxWidth);
        return Container(
          width: double.infinity,
          margin: margin,
          padding: compact ? const EdgeInsets.all(16) : padding,
          decoration: BoxDecoration(
            color: backgroundColor ?? intakeSurfaceColor(context),
            borderRadius: AppRadii.card,
            border: Border.all(color: intakeBorderColor(context), width: 1),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0D3A2413),
                blurRadius: 20,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: child,
        );
      },
    );
  }
}

class IntakeInfoCard extends StatelessWidget {
  const IntakeInfoCard({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.info_outline_rounded,
  });

  final String title;
  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return IntakeCard(
      padding: const EdgeInsets.all(18),
      backgroundColor: intakeWarningColor(context),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: intakeIsDark(context)
                  ? AppColors.applicantDarkSurface
                  : const Color(0xFFFFEDB3),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: IntakePalette.warningIcon, size: 19),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: intakeTextColor(context),
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  message,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: intakeSubtextColor(context),
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class IntakeChoiceCard extends StatelessWidget {
  const IntakeChoiceCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.card,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: selected
              ? (intakeIsDark(context)
                    ? AppColors.applicantDarkSurfaceMuted
                    : const Color(0xFFFFF8E9))
              : intakeSurfaceColor(context),
          borderRadius: AppRadii.card,
          border: Border.all(
            color: selected ? AppColors.gold : intakeMutedBorderColor(context),
            width: selected ? 1.4 : 1,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 24,
              height: 24,
              margin: const EdgeInsets.only(top: 2),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected ? AppColors.gold : AppColors.lightGray,
                  width: 1.6,
                ),
              ),
              child: selected
                  ? const Center(
                      child: CircleAvatar(
                        radius: 5,
                        backgroundColor: AppColors.gold,
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: intakeTextColor(context),
                      fontWeight: FontWeight.w800,
                      ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: intakeSubtextColor(
                        context,
                      ).withValues(alpha: 0.85),
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

InputDecoration intakeInputDecoration(
  BuildContext context, {
  required String hint,
  String? errorText,
  Widget? suffixIcon,
  bool hasValue = false,
}) {
  final border = OutlineInputBorder(
    borderRadius: AppRadii.control,
    borderSide: BorderSide(color: intakeMutedBorderColor(context)),
  );

  return InputDecoration(
    hintText: hint,
    errorText: errorText,
    suffixIcon: suffixIcon,
    filled: true,
    fillColor: intakeSurfaceTintColor(context),
    constraints: const BoxConstraints(minHeight: 58),
    contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 17),
    enabledBorder: border,
    border: border,
    disabledBorder: border,
    focusedBorder: border.copyWith(
      borderSide: const BorderSide(color: AppColors.gold, width: 1.4),
    ),
    errorBorder: border.copyWith(
      borderSide: BorderSide(color: Theme.of(context).colorScheme.error, width: 1.2),
    ),
    focusedErrorBorder: border.copyWith(
      borderSide: BorderSide(color: Theme.of(context).colorScheme.error, width: 1.4),
    ),
    hintStyle: TextStyle(
      color: intakeSubtextColor(context).withValues(alpha: 0.60),
      fontWeight: FontWeight.w500,
    ),
    errorStyle: TextStyle(
      color: Theme.of(context).colorScheme.error,
      fontWeight: FontWeight.w600,
    ),
  );
}

Widget intakeFieldLabel(BuildContext context, String label) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(
      label,
      style: Theme.of(context).textTheme.labelLarge?.copyWith(
        color: intakeTextColor(context),
        fontWeight: FontWeight.w700,
        ),
    ),
  );
}

Widget intakeCompletionIcon(String value) {
  if (value.trim().isEmpty) {
    return const Icon(
      Icons.radio_button_unchecked_rounded,
      color: Color(0xFFD7D0C7),
      size: 20,
    );
  }

  return const Icon(
    Icons.check_circle_outline_rounded,
    color: IntakePalette.success,
    size: 22,
  );
}

class IntakeReviewCard extends StatelessWidget {
  const IntakeReviewCard({
    super.key,
    required this.title,
    required this.rows,
    this.onEdit,
  });

  final String title;
  final List<Widget> rows;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    return IntakeCard(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: intakeTextColor(context),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (onEdit != null)
                TextButton(
                  onPressed: onEdit,
                  child: const Text(
                    'Edit',
                    style: TextStyle(
                      color: AppColors.gold,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          ...rows,
        ],
      ),
    );
  }
}

class IntakeReviewRow extends StatelessWidget {
  const IntakeReviewRow({
    super.key,
    required this.label,
    required this.value,
    this.required = false,
  });

  final String label;
  final String value;
  final bool required;

  @override
  Widget build(BuildContext context) {
    final missing = required && value.trim().isEmpty;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: intakeMutedBorderColor(context), width: 1),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 4,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: intakeSubtextColor(context).withValues(alpha: 0.85),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 6,
            child: Text(
              missing ? 'Missing' : value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: missing ? Theme.of(context).colorScheme.error : intakeTextColor(context),
                fontWeight: missing ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
