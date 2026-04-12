import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';

class ApplicantAccessGate extends StatefulWidget {
  const ApplicantAccessGate({
    super.key,
    required this.child,
  });

  final Widget child;

  @override
  State<ApplicantAccessGate> createState() => _ApplicantAccessGateState();
}

class _ApplicantAccessGateState extends State<ApplicantAccessGate> {
  final SessionService _sessionService = const SessionService();
  bool _isChecking = true;

  @override
  void initState() {
    super.initState();
    _checkAccess();
  }

  Future<void> _checkAccess() async {
    final session = await _sessionService.getCurrentUser();

    if (!mounted) return;

    final isScholar = session.isVerified == true;

    // ❗ If scholar → block applicant routes
    if (isScholar) {
      Navigator.pushNamedAndRemoveUntil(
        context,
        AppRoutes.home,
        (route) => false,
      );
      return;
    }

    setState(() => _isChecking = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_isChecking) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return widget.child;
  }
}