// SMaRT-PDM: Scholars — scholar access gate (mobile widget); renders reusable mobile UI behavior.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/features/scholar/data/services/scholar_access_service.dart';

class ScholarAccessGate extends StatefulWidget {
  final Widget child;
  final String fallbackRoute;
  final bool redirectWhenDenied;

  const ScholarAccessGate({
    super.key,
    required this.child,
    this.fallbackRoute = AppRoutes.home,
    this.redirectWhenDenied = true,
  });

  @override
  // createState: creates create state for the Scholars flow.
  State<ScholarAccessGate> createState() => _ScholarAccessGateState();
}

class _ScholarAccessGateState extends State<ScholarAccessGate> {
  bool? _cachedAccess;
  bool _handledDeniedAccess = false;

  @override
  // initState: handles init state for the Scholars flow.
  void initState() {
    super.initState();
    _loadCachedAccess();
  }

  // _loadCachedAccess: handles load cached access for the Scholars flow.
  Future<void> _loadCachedAccess() async {
    final hasAccess = await ScholarAccessService.isVerifiedScholar();
    if (!mounted) return;

    setState(() {
      _cachedAccess = hasAccess;
    });
  }

  // _resolveAccess: handles resolve access for the Scholars flow.
  bool _resolveAccess(NotificationProvider provider) {
    if (provider.scholarAccessRevision > 0) {
      return provider.hasScholarAccess;
    }

    return provider.hasScholarAccess || (_cachedAccess ?? false);
  }

  // _redirectToFallback: handles redirect to fallback for the Scholars flow.
  void _redirectToFallback() {
    if (_handledDeniedAccess || !mounted || !widget.redirectWhenDenied) {
      return;
    }

    _handledDeniedAccess = true;

    // Route guards remain protective, but they never create unsolicited
    // disabled-module feedback. The bottom navigation tap owns that feedback.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ScholarAccessService.dismissLockedMessage(context);
      AppNavigator.goToTopLevel(context, widget.fallbackRoute);
    });
  }

  @override
  // build: builds build for the Scholars flow.
  Widget build(BuildContext context) {
    final provider = context.watch<NotificationProvider>();
    final hasAccess = _resolveAccess(provider);

    if (_cachedAccess == null &&
        provider.scholarAccessRevision == 0 &&
        !provider.hasScholarAccess) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (!hasAccess) {
      _redirectToFallback();
      return const SizedBox.shrink();
    }

    _handledDeniedAccess = false;
    return widget.child;
  }
}
