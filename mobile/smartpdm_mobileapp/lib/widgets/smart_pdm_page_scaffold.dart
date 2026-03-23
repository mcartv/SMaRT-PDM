import 'package:flutter/material.dart';
import '../constants.dart';
import 'smart_pdm_bottom_nav.dart';

class SmartPdmPageScaffold extends StatelessWidget {
  final Widget child;
  final int selectedIndex;
  final PreferredSizeWidget? appBar;
  final bool applyPadding;
  final bool applyTopSafeArea;

  const SmartPdmPageScaffold({
    super.key,
    required this.child,
    required this.selectedIndex,
    this.appBar,
    this.applyPadding = true,
    this.applyTopSafeArea = true,
  });

  @override
  Widget build(BuildContext context) {
    final content = applyPadding
        ? Padding(
            padding: const EdgeInsets.all(16.0),
            child: child,
          )
        : child;

    return Scaffold(
      appBar: appBar,
      backgroundColor: backgroundColor,
      bottomNavigationBar: SafeArea(
        top: false,
        child: SmartPdmBottomNav(selectedIndex: selectedIndex),
      ),
      body: SafeArea(
        bottom: false,
        top: applyTopSafeArea,
        child: content,
      ),
    );
  }
}

