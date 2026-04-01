import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/constants.dart';

class SmartPdmBottomNav extends StatelessWidget {
  final int selectedIndex;
  final int unreadNotifications;
  
  const SmartPdmBottomNav({
    super.key,
    required this.selectedIndex,
    this.unreadNotifications = 0,
  });

  static const List<String> _routes = [
    '/home',
    '/announcements',
    '/notifications',
    '/interview-schedule',
    '/documents',
  ];

  static const List<IconData> _icons = [
    Icons.home,
    Icons.announcement,
    Icons.notifications,
    Icons.calendar_today,
    Icons.document_scanner,
  ];

  static const List<String> _labels = [
    'Home',
    'Announcements',
    'Notifications',
    'Interviews',
    'Documents',
  ];

  @override
  Widget build(BuildContext context) {
    return BottomNavigationBar(
      type: BottomNavigationBarType.fixed,
      currentIndex: selectedIndex,
      selectedItemColor: primaryColor,
      unselectedItemColor: Colors.grey[600],
      backgroundColor: Colors.white,
      elevation: 8,
      items: List.generate(_labels.length, (index) {
        // Add badge to notifications if there are unread items
        bool hasNotification = index == 2 && unreadNotifications > 0;
        
        return BottomNavigationBarItem(
          icon: Stack(
            children: [
              Icon(_icons[index]),
              if (hasNotification)
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
        if (index == selectedIndex) return;
        Navigator.pushNamed(context, _routes[index]);
      },
    );
  }
}
