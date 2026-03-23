import 'package:flutter/material.dart';
import '../constants.dart';

class SmartPdmBottomNav extends StatelessWidget {
  final int selectedIndex;
  const SmartPdmBottomNav({super.key, required this.selectedIndex});

  static const List<String> _routes = [
    '/dashboard',
    '/scholarships',
    '/application',
    '/obligations',
    '/profile',
  ];

  @override
  Widget build(BuildContext context) {
    return BottomNavigationBar(
      type: BottomNavigationBarType.fixed,
      currentIndex: selectedIndex,
      selectedItemColor: primaryColor,
      unselectedItemColor: Colors.grey[600],
      backgroundColor: Colors.white,
      items: const [
        BottomNavigationBarItem(
          icon: Icon(Icons.home),
          label: 'Home',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.search),
          label: 'Scholarships',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.apps),
          label: 'Applications',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.task),
          label: 'Obligations',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.person),
          label: 'Profile',
        ),
      ],
      onTap: (index) {
        if (index == selectedIndex) return;
        Navigator.pushNamed(context, _routes[index]);
      },
    );
  }
}

