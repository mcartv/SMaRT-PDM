import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/config/app_config.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/scholar_renewal_requirements_screen.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/screens/dashboard_screen.dart';
import 'package:smartpdm_mobileapp/features/menu/presentation/screens/mobile_menu_screen.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/features/scholar/data/services/scholar_access_service.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/screens/payout_schedule_screen.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/screens/ro_assignment_screen.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/widgets/scholar_access_gate.dart';
import 'package:smartpdm_mobileapp/shared/widgets/notification_bell_button.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_bottom_nav.dart';

class TopLevelShellScreen extends StatefulWidget {
  final int initialIndex;

  const TopLevelShellScreen({
    super.key,
    required this.initialIndex,
  });

  static TopLevelShellScreenState? maybeOf(BuildContext context) {
    return context.findAncestorStateOfType<TopLevelShellScreenState>();
  }

  @override
  State<TopLevelShellScreen> createState() => TopLevelShellScreenState();
}

class TopLevelShellScreenState extends State<TopLevelShellScreen> {
  static const Set<int> _scholarOnlyIndexes = <int>{1, 2, 3};

  late final PageController _pageController;
  late int _currentIndex;

  bool _isVerifiedScholar = false;
  bool _isRevertingLockedSwipe = false;

  late final List<Widget> _pages = <Widget>[
    const DashboardScreen(
      showBottomNav: false,
      showTopBar: false,
    ),
    const ScholarAccessGate(
      child: PayoutScheduleScreen(
        showBottomNav: false,
        showTopBar: false,
      ),
    ),
    const ScholarAccessGate(
      child: ROAssignmentScreen(
        showBottomNav: false,
        showTopBar: false,
      ),
    ),
    const ScholarAccessGate(
      child: ScholarRenewalRequirementsScreen(
        showBottomNav: false,
        showTopBar: false,
      ),
    ),
    const MobileMenuScreen(),
  ];

  @override
  void initState() {
    super.initState();

    _currentIndex = widget.initialIndex.clamp(0, 4);
    _pageController = PageController(initialPage: _currentIndex);

    _loadScholarState();

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;

      await MobileRealtimeService.instance.connectFromPrefs(
        backendBaseUrl: AppConfig.apiBaseUrl,
      );

      if (!mounted) return;
      context.read<NotificationProvider>().initialize();
    });
  }

  Future<void> _loadScholarState() async {
    final prefs = await SharedPreferences.getInstance();

    if (!mounted) return;

    setState(() {
      _isVerifiedScholar =
          prefs.getBool('user_has_scholar_access') ?? false;
    });
  }

  @override
  void didUpdateWidget(covariant TopLevelShellScreen oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (widget.initialIndex != oldWidget.initialIndex) {
      switchToIndex(widget.initialIndex, animated: false);
    }
  }

  Future<void> switchToIndex(
    int index, {
    bool animated = true,
  }) async {
    if (!mounted) return;

    final notificationProvider = context.read<NotificationProvider>();
    final hasScholarAccess =
        notificationProvider.hasScholarAccess || _isVerifiedScholar;
    final targetIndex = index.clamp(0, _pages.length - 1);

    if (_scholarOnlyIndexes.contains(targetIndex) && !hasScholarAccess) {
      ScholarAccessService.showLockedMessage(context);
      return;
    }

    if (targetIndex == _currentIndex) return;

    setState(() {
      _currentIndex = targetIndex;
    });

    if (animated) {
      await _pageController.animateToPage(
        targetIndex,
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOutCubic,
      );
      return;
    }

    _pageController.jumpToPage(targetIndex);
  }

  Future<void> _handlePageChanged(
    int index,
    bool hasScholarAccess,
  ) async {
    if (_isRevertingLockedSwipe) return;

    if (_scholarOnlyIndexes.contains(index) && !hasScholarAccess) {
      _isRevertingLockedSwipe = true;
      ScholarAccessService.showLockedMessage(context);

      await _pageController.animateToPage(
        _currentIndex,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
      );

      _isRevertingLockedSwipe = false;
      return;
    }

    if (!mounted || index == _currentIndex) return;

    setState(() {
      _currentIndex = index;
    });
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        toolbarHeight: 76,
        titleSpacing: 18,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        backgroundColor:
            isDark ? const Color(0xFF24180F) : AppColors.white,
        foregroundColor: isDark ? Colors.white : AppColors.darkBrown,
        shape: Border(
          bottom: BorderSide(
            color: isDark
                ? Colors.white.withValues(alpha: 0.08)
                : AppColors.brown.withValues(alpha: 0.10),
          ),
        ),
        title: Row(
          children: [
            SizedBox(
              width: 52,
              height: 52,
              child: Image.asset(
                'assets/images/school_logo.png',
                fit: BoxFit.contain,
                filterQuality: FilterQuality.high,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'SMaRT-PDM',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: isDark ? Colors.white : AppColors.darkBrown,
                      fontWeight: FontWeight.w900,
                      height: 1,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _pageLabel(_currentIndex),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: isDark
                          ? Colors.white70
                          : AppColors.brown.withValues(alpha: 0.78),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: const [
          NotificationBellButton(
            padding: EdgeInsets.only(right: 12),
            iconSize: 27,
          ),
        ],
      ),
      bottomNavigationBar: SmartPdmBottomNav(
        selectedIndex: _currentIndex,
        isVerifiedScholar: hasScholarAccess,
        unreadNotifications: notificationProvider.unreadCount,
        unreadPayoutNotifications: notificationProvider.unreadPayoutCount,
        onTap: (index) => switchToIndex(index),
      ),
      body: PageView(
        controller: _pageController,
        physics: const PageScrollPhysics(),
        onPageChanged: (index) =>
            _handlePageChanged(index, hasScholarAccess),
        children: _pages,
      ),
    );
  }

  String _pageLabel(int index) {
    switch (index) {
      case 1:
        return 'Payout Schedule';
      case 2:
        return 'Return of Obligation';
      case 3:
        return 'Renewal Requirements';
      case 4:
        return 'Menu';
      case 0:
      default:
        return 'Dashboard';
    }
  }
}
