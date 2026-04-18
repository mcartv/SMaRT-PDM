import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/screens/dashboard_screen.dart';
import 'package:smartpdm_mobileapp/features/messaging/presentation/providers/messaging_provider.dart';
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
      context.read<MessagingProvider>().initializeChat();
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
    final messagingProvider = context.watch<MessagingProvider>();
    final hasScholarAccess =
        notificationProvider.hasScholarAccess || _isVerifiedScholar;

    return Scaffold(
      floatingActionButton: _MessagingFab(
        unreadCount: messagingProvider.unreadCount,
        onPressed: () => Navigator.of(context).pushNamed(AppRoutes.messaging),
      ),
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

class _MessagingFab extends StatelessWidget {
  const _MessagingFab({required this.unreadCount, required this.onPressed});

  final int unreadCount;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fabGradient = isDark
        ? const [AppColors.yellow, AppColors.gold]
        : const [Color(0xFFF8F3ED), Color(0xFFF4E1B8)];
    final fabForegroundColor = isDark ? AppColors.darkBrown : AppColors.brown;
    final fabBorderColor = isDark
        ? AppColors.gold.withOpacity(0.2)
        : AppColors.gold.withOpacity(0.55);
    final badgeBorderColor = isDark
        ? Colors.black.withOpacity(0.35)
        : Colors.white.withOpacity(0.9);

    return Stack(
      clipBehavior: Clip.none,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: fabGradient,
            ),
            border: Border.all(color: fabBorderColor),
            boxShadow: [
              BoxShadow(
                color: isDark
                    ? AppColors.brown.withOpacity(0.28)
                    : AppColors.brown.withOpacity(0.16),
                blurRadius: isDark ? 18 : 14,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: FloatingActionButton(
            heroTag: 'messaging-fab',
            onPressed: onPressed,
            elevation: 0,
            highlightElevation: 0,
            backgroundColor: Colors.transparent,
            foregroundColor: fabForegroundColor,
            child: const Icon(Icons.forum_rounded, size: 28),
          ),
        ),
        if (unreadCount > 0)
          Positioned(
            right: -2,
            top: -4,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
              constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
              decoration: BoxDecoration(
                color: AppColors.darkBrown,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: badgeBorderColor, width: 2),
              ),
              child: Text(
                unreadCount > 99 ? '99+' : '$unreadCount',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
