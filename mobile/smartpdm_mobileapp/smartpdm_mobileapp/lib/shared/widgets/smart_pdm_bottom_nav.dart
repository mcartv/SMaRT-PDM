import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/scholar/data/services/scholar_access_service.dart';

class SmartPdmBottomNav extends StatelessWidget {
  static const Set<int> _scholarOnlyIndexes = <int>{1, 2, 3};

  final int selectedIndex;
  final int unreadNotifications;
  final int unreadPayoutNotifications;
  final bool isVerifiedScholar;
  final ValueChanged<int>? onTap;

  const SmartPdmBottomNav({
    super.key,
    required this.selectedIndex,
    this.unreadNotifications = 0,
    this.unreadPayoutNotifications = 0,
    required this.isVerifiedScholar,
    this.onTap,
  });

  static const List<String> _routes = <String>[
    AppRoutes.home,
    AppRoutes.payouts,
    AppRoutes.roAssignment,
    AppRoutes.renewalDocuments,
    AppRoutes.menu,
  ];

  static const List<IconData> _icons = <IconData>[
    Icons.dashboard_rounded,
    Icons.calendar_month_rounded,
    Icons.work_rounded,
    Icons.description_rounded,
    Icons.menu_rounded,
  ];

  static const List<String> _labels = <String>[
    'Dashboard',
    'Payout',
    'Obligation',
    'Renewal',
    'Menu',
  ];

  @override
  Widget build(BuildContext context) {
    final safeIndex = selectedIndex.clamp(0, _routes.length - 1);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final backgroundColor =
        isDark ? const Color(0xFF2D1E12) : AppColors.white;
    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.08)
        : AppColors.brown.withValues(alpha: 0.10);

    return Material(
      color: backgroundColor,
      elevation: 16,
      shadowColor: Colors.black.withValues(alpha: 0.16),
      child: SafeArea(
        top: false,
        child: Container(
          height: 78,
          decoration: BoxDecoration(
            color: backgroundColor,
            border: Border(top: BorderSide(color: borderColor)),
          ),
          child: Row(
            children: List.generate(_routes.length, (index) {
              final selected = index == safeIndex;
              final locked =
                  _scholarOnlyIndexes.contains(index) && !isVerifiedScholar;
              final showBadge =
                  index == 1 && unreadPayoutNotifications > 0;

              return Expanded(
                child: _NavDestination(
                  icon: _icons[index],
                  label: _labels[index],
                  selected: selected,
                  locked: locked,
                  showBadge: showBadge,
                  onPressed: () => _handleTap(context, index, safeIndex),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }

  void _handleTap(
    BuildContext context,
    int index,
    int safeIndex,
  ) {
    if (index == safeIndex) return;

    if (_scholarOnlyIndexes.contains(index) && !isVerifiedScholar) {
      ScholarAccessService.showLockedMessage(context);
      return;
    }

    final callback = onTap;
    if (callback != null) {
      callback(index);
      return;
    }

    AppNavigator.goToTopLevel(context, _routes[index]);
  }
}

class _NavDestination extends StatelessWidget {
  const _NavDestination({
    required this.icon,
    required this.label,
    required this.selected,
    required this.locked,
    required this.showBadge,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final bool locked;
  final bool showBadge;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inactiveColor =
        isDark ? Colors.white70 : AppColors.brown.withValues(alpha: 0.72);
    final disabledColor =
        isDark ? Colors.white38 : AppColors.brown.withValues(alpha: 0.32);
    final activeColor = AppColors.gold;
    final foreground = locked
        ? disabledColor
        : selected
            ? activeColor
            : inactiveColor;

    return Semantics(
      button: true,
      selected: selected,
      enabled: !locked,
      label: locked ? '$label, scholar access required' : label,
      child: InkWell(
        onTap: onPressed,
        splashColor: AppColors.gold.withValues(alpha: 0.10),
        highlightColor: AppColors.gold.withValues(alpha: 0.06),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(2, 7, 2, 6),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOut,
                height: 3,
                width: selected ? 30 : 0,
                margin: const EdgeInsets.only(bottom: 5),
                decoration: BoxDecoration(
                  color: activeColor,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(icon, size: 27, color: foreground),
                  if (locked)
                    Positioned(
                      right: -7,
                      top: -5,
                      child: Container(
                        width: 15,
                        height: 15,
                        decoration: BoxDecoration(
                          color: isDark
                              ? const Color(0xFF24180F)
                              : AppColors.white,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: disabledColor,
                            width: 1,
                          ),
                        ),
                        child: Icon(
                          Icons.lock_rounded,
                          size: 9,
                          color: disabledColor,
                        ),
                      ),
                    ),
                  if (showBadge && !locked)
                    Positioned(
                      right: -6,
                      top: -4,
                      child: Container(
                        width: 9,
                        height: 9,
                        decoration: BoxDecoration(
                          color: Colors.red.shade600,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: isDark
                                ? const Color(0xFF2D1E12)
                                : AppColors.white,
                            width: 1.5,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  label,
                  maxLines: 1,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: foreground,
                    fontSize: 10.5,
                    fontWeight: selected ? FontWeight.w900 : FontWeight.w700,
                    height: 1,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
