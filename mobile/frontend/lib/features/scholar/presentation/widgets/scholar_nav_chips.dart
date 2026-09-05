import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';

class ScholarNavChips extends StatelessWidget {
  final String selectedLabel;
  final ValueChanged<String> onTap;
  final bool hasNewPayouts;

  const ScholarNavChips({
    super.key,
    required this.selectedLabel,
    required this.onTap,
    this.hasNewPayouts = false,
  });

  static const List<String> _labels = ['Payout Schedule', 'Renewal Documents'];

  @override
  Widget build(BuildContext context) {
    final status = Theme.of(context).extension<AppStatusColors>()!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppSectionHeading(
          title: 'Quick Actions',
          subtitle: 'Open your current scholar records and requirements.',
        ),
        const SizedBox(height: AppSpacing.sm),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _labels.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisExtent: AppSizes.minimumTapTarget,
            crossAxisSpacing: AppSpacing.sm,
            mainAxisSpacing: AppSpacing.sm,
          ),
          itemBuilder: (context, index) {
            final label = _labels[index];
            final isSelected = selectedLabel == label;
            final showDot = label == 'Payout Schedule' && hasNewPayouts;

            return Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: AppRadii.control,
                onTap: () => onTap(label),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  curve: Curves.easeOut,
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppColors.gold
                        : AppSurfacePalette.surface(context),
                    borderRadius: AppRadii.control,
                    border: Border.all(
                      color: isSelected
                          ? AppColors.gold
                          : AppSurfacePalette.outline(context),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (isSelected) ...[
                        const Icon(
                          Icons.check_rounded,
                          size: 16,
                          color: AppColors.darkBrown,
                        ),
                        const SizedBox(width: AppSpacing.xs),
                      ],
                      Flexible(
                        child: Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: isSelected
                                ? AppColors.darkBrown
                                : AppSurfacePalette.text(context),
                          ),
                        ),
                      ),
                      if (showDot) ...[
                        const SizedBox(width: AppSpacing.xs),
                        Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            color: status.actionRequiredOutline,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}
