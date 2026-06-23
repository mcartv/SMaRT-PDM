import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';

class SmartPdmBottomNav extends StatelessWidget {
  static const Color _selectedIconColor = Color(0xFFF6B60C);

  final int selectedIndex;
  final int unreadNotifications;
  final int unreadPayoutNotifications;
  final bool isVerifiedScholar;

  const SmartPdmBottomNav({
    super.key,
    required this.selectedIndex,
    this.unreadNotifications = 0,
    this.unreadPayoutNotifications = 0,
    required this.isVerifiedScholar,
  });

  static const List<String> _routes = [
    AppRoutes.home,
    AppRoutes.notifications,
    AppRoutes.profile,
  ];

  static const List<IconData> _icons = [
    Icons.home_rounded,
    Icons.school_rounded,
    Icons.person_outline_rounded,
  ];

  static const List<String> _labels = ['Home', 'Scholar', 'Profile'];

  @override
  Widget build(BuildContext context) {
    final safeIndex = selectedIndex.clamp(0, _routes.length - 1);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final navTheme = theme.bottomNavigationBarTheme;
    final backgroundColor =
        navTheme.backgroundColor ?? theme.colorScheme.surface;
    final selectedLabelColor =
        isDark ? Colors.white : theme.colorScheme.onSurface;
    final unselectedItemColor =
        navTheme.unselectedItemColor ??
        (isDark ? Colors.white70 : const Color(0xFFA8A39B));

    return Theme(
      data: theme.copyWith(
        splashFactory: NoSplash.splashFactory,
        splashColor: Colors.transparent,
        highlightColor: Colors.transparent,
        hoverColor: Colors.transparent,
      ),
      child: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: safeIndex,
        enableFeedback: false,
        backgroundColor: backgroundColor,
        selectedItemColor: selectedLabelColor,
        unselectedItemColor: unselectedItemColor,
        showSelectedLabels: true,
        showUnselectedLabels: true,
        selectedLabelStyle: TextStyle(
          fontWeight: FontWeight.w500,
          color: selectedLabelColor,
          fontSize: 12,
          height: 1,
        ),
        unselectedLabelStyle: TextStyle(
          fontWeight: FontWeight.w500,
          color: unselectedItemColor,
          fontSize: 12,
          height: 1,
        ),
        onTap: (index) {
          if (index == safeIndex) return;
          AppNavigator.goToTopLevel(context, _routes[index]);
        },
        items: List.generate(_routes.length, (index) {
          final showBadge =
              index == 1 && isVerifiedScholar && unreadPayoutNotifications > 0;

          return BottomNavigationBarItem(
            label: _labels[index],
            icon: _buildNavIcon(
              context: context,
              icon: _icons[index],
              isSelected: false,
              showBadge: showBadge,
            ),
            activeIcon: _buildNavIcon(
              context: context,
              icon: _icons[index],
              isSelected: true,
              showBadge: showBadge,
            ),
          );
        }),
      ),
    );
  }

  Widget _buildNavIcon({
    required BuildContext context,
    required IconData icon,
    required bool isSelected,
    required bool showBadge,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final unselectedItemColor = isDark ? Colors.white70 : const Color(0xFFA8A39B);
    final selectedIconBackground = isDark
        ? AppColors.gold.withOpacity(0.16)
        : const Color(0xFFF1EFEB);
    final iconWidget = Icon(
      icon,
      color: isSelected ? _selectedIconColor : unselectedItemColor,
      size: 24,
    );

    final content = isSelected
        ? Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
            decoration: BoxDecoration(
              color: selectedIconBackground,
              borderRadius: const BorderRadius.all(Radius.circular(999)),
            ),
            child: iconWidget,
          )
        : iconWidget;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        SizedBox(
          width: 56,
          height: 38,
          child: Center(
            child: content,
          ),
        ),
        if (showBadge)
          Positioned(
            right: isSelected ? 12 : -4,
            top: isSelected ? 4 : -4,
            child: Container(
              width: 9,
              height: 9,
              decoration: const BoxDecoration(
                color: Colors.red,
                shape: BoxShape.circle,
              ),
            ),
          ),
      ],
    );
  }
}
