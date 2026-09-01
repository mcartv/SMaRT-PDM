import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';

class ApplicantAccessGate extends StatefulWidget {
  const ApplicantAccessGate({super.key, required this.child, this.routeName});

  final Widget child;
  final String? routeName;

  @override
  State<ApplicantAccessGate> createState() => _ApplicantAccessGateState();
}

class _ApplicantAccessGateState extends State<ApplicantAccessGate> {
  bool _isChecking = true;
  bool _cachedScholarAccess = false;
  bool _redirectScheduled = false;

  static final Set<String> applicantOnlyRoutes = {
    AppRoutes.scholarshipOpenings,
    AppRoutes.documents,
    AppRoutes.status,
    AppRoutes.endorsement,
  };

  bool _shouldBlockScholar() {
    final route = widget.routeName;
    if (route == null || route.isEmpty) return false;
    return applicantOnlyRoutes.contains(route);
  }

  @override
  void initState() {
    super.initState();
    _checkAccess();
  }

  Future<void> _checkAccess() async {
    final prefs = await SharedPreferences.getInstance();
    final hasScholarAccess = prefs.getBool('user_has_scholar_access') ?? false;

    if (!mounted) return;

    setState(() {
      _cachedScholarAccess = hasScholarAccess;
      _isChecking = false;
    });
  }

  void _redirectScholar() {
    if (_redirectScheduled || !mounted) return;
    _redirectScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      Navigator.pushNamedAndRemoveUntil(
        context,
        AppRoutes.home,
        (route) => false,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NotificationProvider>();
    final hasScholarAccess = provider.scholarAccessRevision > 0
        ? provider.hasScholarAccess
        : provider.hasScholarAccess || _cachedScholarAccess;

    if (_isChecking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (hasScholarAccess && _shouldBlockScholar()) {
      _redirectScholar();
      return const SizedBox.shrink();
    }

    return widget.child;
  }
}
