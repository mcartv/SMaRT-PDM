import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/profile/data/services/profile_service.dart';

class ProfileCompletionGate extends StatefulWidget {
  const ProfileCompletionGate({
    super.key,
    required this.child,
  });

  final Widget child;

  @override
  State<ProfileCompletionGate> createState() => _ProfileCompletionGateState();
}

class _ProfileCompletionGateState extends State<ProfileCompletionGate> {
  final SessionService _sessionService = const SessionService();
  final ProfileService _profileService = ProfileService();

  bool _isChecking = true;

  @override
  void initState() {
    super.initState();
    _checkAccess();
  }

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

    try {
      final profile = await _profileService.fetchMyProfile();

      if (!mounted) return;

      if (!_isProfileComplete(profile)) {
        Navigator.pushNamedAndRemoveUntil(
          context,
          AppRoutes.completeProfile,
          (route) => false,
        );
        return;
      }

      setState(() {
        _isChecking = false;
      });
    } catch (_) {
      await _sessionService.clearSession();

      if (!mounted) return;

      Navigator.pushNamedAndRemoveUntil(
        context,
        AppRoutes.login,
        (route) => false,
      );
    }
  }

  bool _isProfileComplete(Map<String, dynamic> profile) {
    final firstName = profile['first_name']?.toString().trim() ?? '';
    final lastName = profile['last_name']?.toString().trim() ?? '';
    final courseCode = profile['course_code']?.toString().trim() ?? '';
    final yearLevelRaw = profile['year_level'];

    final yearLevel = yearLevelRaw is int
        ? yearLevelRaw
        : int.tryParse(yearLevelRaw?.toString() ?? '');

    return firstName.isNotEmpty &&
        lastName.isNotEmpty &&
        courseCode.isNotEmpty &&
        yearLevel != null &&
        yearLevel > 0;
  }

  @override
  Widget build(BuildContext context) {
    if (_isChecking) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    return widget.child;
  }
}