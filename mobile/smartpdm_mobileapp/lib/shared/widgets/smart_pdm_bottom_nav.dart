import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';

class SmartPdmBottomNav extends StatelessWidget {
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
    Icons.notifications_none_rounded,
    Icons.person_outline_rounded,
  ];

  static const List<String> _labels = ['Home', 'Updates', 'Profile'];

  @override
  Widget build(BuildContext context) {
    final safeIndex = selectedIndex.clamp(0, _routes.length - 1);

    return BottomNavigationBar(
      type: BottomNavigationBarType.fixed,
      currentIndex: safeIndex,
      selectedItemColor: primaryColor,
      unselectedItemColor: Colors.grey,
      onTap: (index) {
        if (index == safeIndex) return;
        AppNavigator.goToTopLevel(context, _routes[index]);
      },
      items: List.generate(_routes.length, (index) {
        final showBadge = index == 1 && unreadNotifications > 0;

        return BottomNavigationBarItem(
          label: _labels[index],
          icon: Stack(
            clipBehavior: Clip.none,
            children: [
              Icon(_icons[index]),
              if (showBadge)
                Positioned(
                  right: -4,
                  top: -4,
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
          ),
        );
      }),
    );
  }
}
