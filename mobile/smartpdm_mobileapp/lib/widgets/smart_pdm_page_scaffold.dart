import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
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

class _SmartPdmPageScaffoldState extends State<SmartPdmPageScaffold> {
  bool _isScholar = false;
  String _userName = 'Scholar';

  @override
  void initState() {
    super.initState();
    _loadUserInfo();
  }

  Future<void> _loadUserInfo() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _isScholar = prefs.getBool('user_is_verified') ?? false;
      _userName = prefs.getString('user_student_id') ?? 'Scholar';
    });
  }

  @override
  Widget build(BuildContext context) {
    final content = widget.applyPadding
        ? Padding(padding: const EdgeInsets.all(16.0), child: widget.child)
        : widget.child;

    return Scaffold(
      appBar: widget.appBar,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      drawer: widget.showDrawer
          ? SmartPdmDrawer(isScholar: _isScholar, userName: _userName)
          : null,
      bottomNavigationBar: widget.showBottomNav
          ? SafeArea(
              top: false,
              child: SmartPdmBottomNav(
                selectedIndex: widget.selectedIndex,
                unreadNotifications: widget.unreadNotifications,
              ),
            )
          : null,
      body: SafeArea(
        bottom: false,
        top: widget.applyTopSafeArea,
        child: content,
      ),
    );
  }
}
