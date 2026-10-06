// SMaRT-PDM: Authentication — profile completion gate (mobile screen); loads state, handles user actions, and renders the screen.
import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';

class ProfileCompletionGate extends StatefulWidget {
  const ProfileCompletionGate({super.key, required this.child});

  final Widget child;

  @override
  // createState: creates create state for the Authentication flow.
  State<ProfileCompletionGate> createState() => _ProfileCompletionGateState();
}

class _ProfileCompletionGateState extends State<ProfileCompletionGate> {
  final SessionService _sessionService = const SessionService();

  bool _isChecking = true;

  @override
  // initState: handles init state for the Authentication flow.
  void initState() {
    super.initState();
    _checkAccess();
  }

  // _checkAccess: handles check access for the Authentication flow.
  Future<void> _checkAccess() async {
    final isValid = await _sessionService.isSessionValid();

    if (!mounted) return;

    if (!isValid) {
      await _sessionService.clearSession();

      if (!mounted) return;

      Navigator.pushNamedAndRemoveUntil(
        context,
        AppRoutes.login,
        (route) => false,
      );
      return;
    }

    setState(() {
      _isChecking = false;
    });
  }

  @override
  // build: builds build for the Authentication flow.
  Widget build(BuildContext context) {
    if (_isChecking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return widget.child;
  }
}
