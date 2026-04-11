import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/screens/applicant/notifications_screen.dart';
import 'package:smartpdm_mobileapp/screens/common/dashboard_screen.dart';
import 'package:smartpdm_mobileapp/screens/profile/profile_screen.dart';
import 'package:smartpdm_mobileapp/screens/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/screens/scholar/payout_schedule_screen.dart';
import 'package:smartpdm_mobileapp/widgets/scholar_access_gate.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_bottom_nav.dart';

class TopLevelShellScreen extends StatefulWidget {
  final int initialIndex;

  const TopLevelShellScreen({super.key, required this.initialIndex});

  static _TopLevelShellScreenState? maybeOf(BuildContext context) {
    return context.findAncestorStateOfType<_TopLevelShellScreenState>();
  }

  @override
  State<TopLevelShellScreen> createState() => _TopLevelShellScreenState();
}

class _TopLevelShellScreenState extends State<TopLevelShellScreen> {
  late final PageController _pageController;
  late int _currentIndex;
  bool _isVerifiedScholar = false;

  late final List<Widget> _pages = [
    const DashboardScreen(showBottomNav: false),
    const ScholarAccessGate(child: PayoutScheduleScreen(showBottomNav: false)),
    const NotificationsScreen(showBottomNav: false),
    const ProfileScreen(showBottomNav: false),
  ];

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
    _loadScholarState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<NotificationProvider>().initialize();
    });
  }

  Future<void> _loadScholarState() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;

    setState(() {
      _isVerifiedScholar = prefs.getBool('user_is_verified') ?? false;
    });
  }

  @override
  void didUpdateWidget(covariant TopLevelShellScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialIndex != oldWidget.initialIndex) {
      switchToIndex(widget.initialIndex, animated: false);
    }
  }

  void switchToIndex(int index, {bool animated = true}) {
    if (!mounted) return;

    final targetIndex = index.clamp(0, _pages.length - 1);
    if (targetIndex == _currentIndex) return;

    setState(() {
      _currentIndex = targetIndex;
    });

    if (animated) {
      _pageController.animateToPage(
        targetIndex,
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOutCubic,
      );
      return;
    }

    _pageController.jumpToPage(targetIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      bottomNavigationBar: Consumer<NotificationProvider>(
        builder: (context, notificationProvider, child) {
          return SafeArea(
            top: false,
            child: SmartPdmBottomNav(
              selectedIndex: _currentIndex,
              isVerifiedScholar: _isVerifiedScholar,
              unreadNotifications: notificationProvider.unreadCount,
            ),
          );
        },
      ),
      body: PageView(
        controller: _pageController,
        physics: const NeverScrollableScrollPhysics(),
        children: _pages,
      ),
    );
  }
}
