import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'smart_pdm_bottom_nav.dart';
import 'smart_pdm_drawer.dart';

class SmartPdmPageScaffold extends StatefulWidget {
  final Widget child;
  final int selectedIndex;
  final PreferredSizeWidget? appBar;
  final bool applyPadding;
  final bool applyTopSafeArea;
  final bool showDrawer;
  final bool showBottomNav;
  final int unreadNotifications;

  const SmartPdmPageScaffold({
    super.key,
    required this.child,
    required this.selectedIndex,
    this.appBar,
    this.applyPadding = true,
    this.applyTopSafeArea = true,
    this.showDrawer = false,
    this.showBottomNav = true,
    this.unreadNotifications = 0,
  });

  @override
  State<SmartPdmPageScaffold> createState() => _SmartPdmPageScaffoldState();
}

class _SmartPdmPageScaffoldState extends State<SmartPdmPageScaffold>
    with WidgetsBindingObserver {
  static const Duration _idleLimit = Duration(minutes: 30);

  final SessionService _sessionService = const SessionService();

  bool _isScholar = false;
  String _userName = 'Scholar';

  Timer? _idleTimer;
  DateTime? _backgroundedAt;
  bool _loggingOut = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadUserInfo();
    _startIdleTimer();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _idleTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_loggingOut) return;

    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden) {
      _backgroundedAt = DateTime.now();
    }

    if (state == AppLifecycleState.resumed) {
      final previousBackgroundTime = _backgroundedAt;
      _backgroundedAt = null;

      if (previousBackgroundTime != null) {
        final inactiveDuration = DateTime.now().difference(previousBackgroundTime);
        if (inactiveDuration >= _idleLimit) {
          _handleAutoLogout();
          return;
        }
      }

      _startIdleTimer();
    }
  }

  Future<void> _loadUserInfo() async {
    final prefs = await SharedPreferences.getInstance();

    if (!mounted) return;

    setState(() {
      _isScholar = prefs.getBool('user_has_scholar_access') ?? false;
      _userName = prefs.getString('user_student_id') ?? 'Scholar';
    });
  }

  void _startIdleTimer() {
    _idleTimer?.cancel();
    _idleTimer = Timer(_idleLimit, _handleAutoLogout);
  }

  void _resetIdleTimer() {
    if (_loggingOut) return;
    _startIdleTimer();
  }

  Future<void> _handleAutoLogout() async {
    if (_loggingOut) return;
    _loggingOut = true;

    _idleTimer?.cancel();

    await _sessionService.clearSession();

    if (!mounted) return;

    Navigator.of(context).pushNamedAndRemoveUntil(
      AppRoutes.login,
      (route) => false,
    );

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Session expired due to inactivity. Please log in again.'),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final notificationProvider = context.watch<NotificationProvider>();
    final hasScholarAccess =
        notificationProvider.hasScholarAccess || _isScholar;
    final content = widget.applyPadding
        ? Padding(
            padding: const EdgeInsets.all(16.0),
            child: widget.child,
          )
        : widget.child;

    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: _resetIdleTimer,
      onPanDown: (_) => _resetIdleTimer(),
      child: Scaffold(
        appBar: widget.appBar,
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        drawer: widget.showDrawer
            ? SmartPdmDrawer(
                isScholar: hasScholarAccess,
                userName: _userName,
              )
            : null,
        bottomNavigationBar: widget.showBottomNav
            ? SafeArea(
                top: false,
                child: SmartPdmBottomNav(
                  selectedIndex: widget.selectedIndex,
                  isVerifiedScholar: hasScholarAccess,
                  unreadNotifications: widget.unreadNotifications > 0
                      ? widget.unreadNotifications
                      : notificationProvider.unreadCount,
                ),
              )
            : null,
        body: SafeArea(
          bottom: false,
          top: widget.applyTopSafeArea,
          child: content,
        ),
      ),
    );
  }
}
