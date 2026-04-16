import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/features/scholar/data/services/scholar_access_service.dart';

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
    final theme = Theme.of(context);
    final bottomNavTheme = theme.bottomNavigationBarTheme;

    return BottomNavigationBar(
      type: BottomNavigationBarType.fixed,
      currentIndex: currentIndex,
      selectedItemColor: bottomNavTheme.selectedItemColor ?? primaryColor,
      unselectedItemColor:
          bottomNavTheme.unselectedItemColor ?? Colors.grey[600],
      backgroundColor:
          bottomNavTheme.backgroundColor ?? theme.colorScheme.surface,
      elevation: 8,
      items: List.generate(_labels.length, (index) {
        final hasUnreadNotifications = index == 2 && unreadNotifications > 0;
        final hasUnreadPayouts = index == 1 && unreadPayoutNotifications > 0;

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
              if (hasUnreadPayouts)
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
                      minWidth: 8,
                      minHeight: 8,
                    ),
                  ),
                ),
            ],
          ),
          label: _labels[index],
        );
      }),
      onTap: (index) async {
        if (index == currentIndex) return;
        if (index == 1 && !isVerifiedScholar) {
          ScholarAccessService.showLockedMessage(context);
          return;
        }
        AppNavigator.goToTopLevel(context, _routes[index]);
      },
    );
  }
}
