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

Color intakePageColor(BuildContext context) =>
    AppSurfacePalette.background(context);

Color intakeSurfaceColor(BuildContext context) =>
    AppSurfacePalette.surface(context);

Color intakeSurfaceTintColor(BuildContext context) =>
    AppSurfacePalette.surfaceMuted(context);

Color intakeBorderColor(BuildContext context) =>
    AppSurfacePalette.outline(context);

Color intakeMutedBorderColor(BuildContext context) =>
    AppSurfacePalette.outline(context).withValues(alpha: 0.82);

Color intakeTextColor(BuildContext context) => AppSurfacePalette.text(context);

Color intakeSubtextColor(BuildContext context) =>
    AppSurfacePalette.mutedText(context);

TextStyle intakeInputTextStyle(BuildContext context, {bool readOnly = false}) =>
    Theme.of(context).textTheme.bodyLarge?.copyWith(
      color: readOnly
          ? intakeTextColor(context).withValues(alpha: 0.88)
          : intakeTextColor(context),
      fontWeight: FontWeight.w400,
    ) ??
    TextStyle(
      color: readOnly
          ? intakeTextColor(context).withValues(alpha: 0.88)
          : intakeTextColor(context),
      fontSize: 16,
      fontWeight: FontWeight.w400,
    );

String intakeActionHint(String hint) {
  final normalized = hint.trim();
  if (normalized.startsWith('Enter ') ||
      normalized.startsWith('Select ') ||
      normalized.startsWith('Choose ') ||
      normalized.startsWith('Tap ') ||
      normalized.startsWith('Auto-') ||
      normalized.startsWith('Assigned ')) {
    return normalized;
  }

  return switch (normalized) {
    'Last Name' => 'Enter last name',
    'First Name' => 'Enter first name',
    'Middle Name' => 'Enter middle name',
    'School' => 'Enter school name',
    'Address' => 'Enter school address',
    'Honors / Awards' => 'Enter honors or awards',
    'Club / Org' => 'Enter club or organization',
    'Course' => 'Assigned course',
    'Year Level' => 'Select year level',
    'Section' => 'Select section',
    'Student Number' => 'Assigned student number',
    'Learner Reference Number' => 'Enter learner reference number',
    'Specify other financial support' => 'Enter other financial support',
    'Occupation' => 'Enter occupation',
    'Company Name / Address' => 'Enter company name or address',
    'Parent or guardian address' => 'Enter parent or guardian address',
    'City / Municipality' => 'Enter city or municipality',
    'Province' => 'Enter province',
    'Specify' => 'Enter details',
    'School, course, school year, amount' =>
      'Enter school, course, school year, and amount',
    'Explain the disciplinary action' => 'Enter a brief explanation',
    '09171234567' => 'Enter mobile number',
    _ => normalized,
  };
}

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
  bool readOnly = false,
}) {
  final isDark = intakeIsDark(context);
  final theme = Theme.of(context);
  final primaryColor = theme.colorScheme.primary;
  final border = OutlineInputBorder(
    borderRadius: AppRadii.control,
    borderSide: BorderSide(
      color: isDark
          ? AppColors.applicantDarkTextMuted.withValues(alpha: 0.62)
          : AppColors.brown.withValues(alpha: 0.50),
      width: 1.2,
    ),
  );

  return InputDecoration(
    hintText: intakeActionHint(hint),
    errorText: errorText,
    suffixIcon: suffixIcon,
    filled: true,
    fillColor: readOnly
        ? intakeSurfaceTintColor(context)
        : intakeSurfaceColor(context),
    constraints: const BoxConstraints(minHeight: 58),
    contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 17),
    enabledBorder: border,
    border: border,
    disabledBorder: border,
    focusedBorder: border.copyWith(
      borderSide: BorderSide(color: primaryColor, width: 2),
    ),
    errorBorder: border.copyWith(
      borderSide: BorderSide(
        color: Theme.of(context).colorScheme.error,
        width: 1.5,
      ),
    ),
    focusedErrorBorder: border.copyWith(
      borderSide: BorderSide(
        color: Theme.of(context).colorScheme.error,
        width: 1.8,
      ),
    ),
    hintStyle: TextStyle(
      color: intakeSubtextColor(context).withValues(alpha: 0.82),
      fontWeight: FontWeight.w400,
    ),
    errorStyle: TextStyle(
      color: Theme.of(context).colorScheme.error,
      fontWeight: FontWeight.w600,
    ),
  );
}

Widget intakeRequiredText(
  BuildContext context,
  String label, {
  bool required = false,
  TextStyle? style,
}) {
  final hasRequiredMarker = required || label.trimRight().endsWith('*');
  final cleanLabel = label.replaceFirst(RegExp(r'\s*\*\s*$'), '').trimRight();
  final effectiveStyle =
      style ??
      Theme.of(context).textTheme.labelLarge?.copyWith(
        color: intakeTextColor(context),
        fontWeight: FontWeight.w700,
      );

  return Text.rich(
    TextSpan(
      style: effectiveStyle,
      children: [
        TextSpan(text: cleanLabel),
        if (hasRequiredMarker)
          TextSpan(
            text: ' *',
            style: effectiveStyle?.copyWith(
              color: Theme.of(context).colorScheme.error,
              fontWeight: FontWeight.w900,
            ),
          ),
      ],
    ),
  );
}

Widget intakeFieldLabel(
  BuildContext context,
  String label, {
  bool required = false,
}) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: intakeRequiredText(context, label, required: required),
  );
}

Widget? intakeCompletionIcon(String value, {bool isValid = true}) {
  if (value.trim().isEmpty || !isValid) return null;

  return const Icon(
    Icons.check_circle_outline_rounded,
    color: IntakePalette.success,
    size: 19,
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
                color: missing
                    ? Theme.of(context).colorScheme.error
                    : intakeTextColor(context),
                fontWeight: missing ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
