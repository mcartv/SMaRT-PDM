import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/navigation/app_navigator.dart';
import 'package:smartpdm_mobileapp/navigation/app_routes.dart';
import 'package:smartpdm_mobileapp/services/scholar_access_service.dart';

class ScholarAccessGate extends StatefulWidget {
  final Widget child;
  final String fallbackRoute;

  const ScholarAccessGate({
    super.key,
    required this.child,
    this.fallbackRoute = AppRoutes.home,
  });

  @override
  State<ScholarAccessGate> createState() => _ScholarAccessGateState();
}

class _ScholarAccessGateState extends State<ScholarAccessGate> {
  bool? _hasAccess;
  bool _handledDeniedAccess = false;

  @override
  void initState() {
    super.initState();
    _loadAccess();
  }

  Future<void> _loadAccess() async {
    final hasAccess = await ScholarAccessService.isVerifiedScholar();
    if (!mounted) return;

    setState(() {
      _hasAccess = hasAccess;
    });

    if (!hasAccess) {
      _redirectToFallback();
    }
  }

  void _redirectToFallback() {
    if (_handledDeniedAccess || !mounted) return;
    _handledDeniedAccess = true;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ScholarAccessService.showLockedMessage(context);
      AppNavigator.goToTopLevel(context, widget.fallbackRoute);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_hasAccess == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_hasAccess == false) {
      return const SizedBox.shrink();
    }

    return widget.child;
  }
}
