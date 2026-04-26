import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';

class ApplicantAccessGate extends StatefulWidget {
  const ApplicantAccessGate({super.key, required this.child, this.routeName});

  final Widget child;
  final String? routeName;

  @override
  State<ApplicantAccessGate> createState() => _ApplicantAccessGateState();
}

class _ApplicantAccessGateState extends State<ApplicantAccessGate> {
  bool _isChecking = true;

  static final Set<String> applicantOnlyRoutes = {
    AppRoutes.scholarshipOpenings,
    AppRoutes.documents,
    AppRoutes.status,
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

    if (hasScholarAccess && _shouldBlockScholar()) {
      Navigator.pushNamedAndRemoveUntil(
        context,
        AppRoutes.home,
        (route) => false,
      );
      return;
    }

    setState(() {
      _isChecking = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isChecking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return widget.child;
  }
}
