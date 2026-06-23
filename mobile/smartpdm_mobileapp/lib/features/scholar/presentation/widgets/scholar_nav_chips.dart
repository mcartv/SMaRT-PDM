import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';

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

  static const List<String> _labels = [
    'Payout Schedule',
    'Renewal Documents',
    'RO Assignment',
    'RO Completion',
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final sectionLabelColor = isDark ? Colors.white70 : Colors.grey.shade600;
    final unselectedBackgroundColor = isDark
        ? const Color(0xFF332216)
        : Colors.white;
    final unselectedBorderColor = isDark
        ? Colors.white12
        : primaryColor.withOpacity(0.25);
    final unselectedTextColor = isDark ? Colors.white : Colors.black87;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        /// 🔹 SECTION LABEL
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          child: Text(
            'Quick Actions',
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w600,
              color: sectionLabelColor,
              letterSpacing: 0.3,
            ),
          ),
        ),

        /// 🔹 GRID TABS
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _labels.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisExtent: 46,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
          ),
          itemBuilder: (context, index) {
            final label = _labels[index];
            final isSelected = selectedLabel == label;
            final showDot = label == 'Payout Schedule' && hasNewPayouts;

            return InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => onTap(label),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOut,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: isSelected ? primaryColor : unselectedBackgroundColor,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isSelected ? primaryColor : unselectedBorderColor,
                  ),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: primaryColor.withOpacity(0.18),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ]
                      : [],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (isSelected) ...[
                      const Icon(Icons.check, size: 16, color: Colors.white),
                      const SizedBox(width: 6),
                    ],

                    Flexible(
                      child: Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: isSelected ? Colors.white : unselectedTextColor,
                        ),
                      ),
                    ),

                    if (showDot) ...[
                      const SizedBox(width: 6),
                      Container(
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          color: Colors.redAccent,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}
