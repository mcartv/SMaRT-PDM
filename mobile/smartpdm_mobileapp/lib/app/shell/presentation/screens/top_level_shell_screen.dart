import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/screens/dashboard_screen.dart';
import 'package:smartpdm_mobileapp/features/profile/presentation/screens/profile_screen.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/screens/payout_schedule_screen.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/widgets/scholar_access_gate.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_bottom_nav.dart';

class TopLevelShellScreen extends StatefulWidget {
  final int initialIndex;

  const TopLevelShellScreen({super.key, required this.initialIndex});

  static TopLevelShellScreenState? maybeOf(BuildContext context) {
    return context.findAncestorStateOfType<TopLevelShellScreenState>();
  }

  @override
  State<TopLevelShellScreen> createState() => TopLevelShellScreenState();
}

class TopLevelShellScreenState extends State<TopLevelShellScreen> {
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
      _isVerifiedScholar = prefs.getBool('user_has_scholar_access') ?? false;
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
    final notificationProvider = context.watch<NotificationProvider>();
    final hasScholarAccess =
        notificationProvider.hasScholarAccess || _isVerifiedScholar;

    return Scaffold(
      bottomNavigationBar: SafeArea(
        top: false,
        child: SmartPdmBottomNav(
          selectedIndex: _currentIndex,
          isVerifiedScholar: hasScholarAccess,
          unreadNotifications: notificationProvider.unreadCount,
          unreadPayoutNotifications: notificationProvider.unreadPayoutCount,
        ),
      ),
      body: PageView(
        controller: _pageController,
        physics: const NeverScrollableScrollPhysics(),
        children: _pages,
      ),
    );
  }
}
