import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/navigation/app_navigator.dart';
import 'package:smartpdm_mobileapp/navigation/app_routes.dart';

class SmartPdmBottomNav extends StatelessWidget {
  final int selectedIndex;
  final int unreadNotifications;

  const SmartPdmBottomNav({
    super.key,
    required this.selectedIndex,
    this.unreadNotifications = 0,
  });

  static const List<String> _routes = [
    AppRoutes.home,
    AppRoutes.payouts,
    AppRoutes.notifications,
    AppRoutes.profile,
  ];

  static const List<IconData> _icons = [
    Icons.home,
    Icons.workspace_premium,
    Icons.notifications_outlined,
    Icons.person_outline,
  ];

  static const List<String> _labels = [
    'Home',
    'Scholar',
    'Notifications',
    'Profile',
  ];

  @override
  Widget build(BuildContext context) {
    final currentIndex = selectedIndex.clamp(0, _labels.length - 1);

    return BottomNavigationBar(
      type: BottomNavigationBarType.fixed,
      currentIndex: currentIndex,
      selectedItemColor: primaryColor,
      unselectedItemColor: Colors.grey[600],
      backgroundColor: Colors.white,
      elevation: 8,
      items: List.generate(_labels.length, (index) {
        final hasUnreadNotifications = index == 2 && unreadNotifications > 0;

        return BottomNavigationBarItem(
          icon: Stack(
            children: [
              Icon(_icons[index]),
              if (hasUnreadNotifications)
                Positioned(
                  right: 0,
                  top: 0,
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: const BoxDecoration(
                      color: Colors.red,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 16,
                      minHeight: 16,
                    ),
                    child: Text(
                      unreadNotifications > 9 ? '9+' : '$unreadNotifications',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
          label: _labels[index],
        );
      }),
      onTap: (index) {
        if (index == currentIndex) return;
        AppNavigator.goToTopLevel(context, _routes[index]);
      },
    );
  }
}
