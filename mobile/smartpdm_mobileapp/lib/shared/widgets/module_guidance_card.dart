import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';

class ModuleGuidanceCard extends StatefulWidget {
  const ModuleGuidanceCard({
    super.key,
    required this.title,
    required this.message,
    this.initiallyExpanded = false,
    this.icon = Icons.info_outline_rounded,
  });

  final String title;
  final String message;
  final bool initiallyExpanded;
  final IconData icon;

  @override
  State<ModuleGuidanceCard> createState() => _ModuleGuidanceCardState();
}

class _ModuleGuidanceCardState extends State<ModuleGuidanceCard> {
  late bool _expanded;

  @override
  void initState() {
    super.initState();
    _expanded = widget.initiallyExpanded;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2B1D13) : const Color(0xFFFFFBF4),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: AppColors.gold.withValues(alpha: isDark ? 0.35 : 0.45),
        ),
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: AppColors.gold.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(widget.icon, color: AppColors.gold, size: 20),
                  ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Text(
                      widget.title,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            color: isDark ? Colors.white : AppColors.darkBrown,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                  ),
                  Icon(
                    _expanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: isDark ? Colors.white70 : AppColors.brown,
                  ),
                ],
              ),
            ),
          ),
          AnimatedCrossFade(
            duration: const Duration(milliseconds: 180),
            crossFadeState: _expanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            firstChild: const SizedBox(width: double.infinity),
            secondChild: Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  widget.message,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isDark ? Colors.white70 : AppColors.brown,
                        height: 1.5,
                      ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
