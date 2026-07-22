import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/shared/formatters/student_id_input_formatter.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  final SessionService _sessionService = const SessionService();
  final TextEditingController _studentIdController = TextEditingController();

  bool _isCheckingSession = true;
  bool _isLookingUp = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final isValid = await _sessionService.isSessionValid();

    if (!mounted) return;

    if (isValid) {
      Navigator.pushReplacementNamed(context, AppRoutes.home);
      return;
    }

    await _sessionService.clearSession();
    if (mounted) setState(() => _isCheckingSession = false);
  }

  Future<Map<String, dynamic>?> _lookupStudent() async {
    final studentId = StudentIdInputFormatter.toFullStudentId(
      _studentIdController.text,
    );

    if (!RegExp(r'^PDM-\d{4}-\d{6}$').hasMatch(studentId)) {
      setState(() => _error = 'Use the format PDM-0000-000000.');
      return null;
    }

    setState(() {
      _isLookingUp = true;
      _error = null;
    });

    try {
      final response = await ApiClient().postJson(
        '/api/auth/check-student-id',
        body: {'student_id': studentId},
      );

      if (response['exists'] != true) {
        setState(() => _error = 'Student ID was not found in the registry.');
        return null;
      }

      return {
        ...response,
        'fullStudentId': studentId,
      };
    } catch (_) {
      setState(() => _error = 'Unable to connect to the server.');
      return null;
    } finally {
      if (mounted) setState(() => _isLookingUp = false);
    }
  }

  Future<void> _goToLogin() async {
    final result = await _lookupStudent();
    if (result == null || !mounted) return;

    final student =
        (result['student'] as Map?)?.cast<String, dynamic>() ?? {};
    final studentId = result['fullStudentId']?.toString() ?? '';

    if (result['hasAccount'] != true) {
      _showMessage(
        'No account is connected to this Student ID yet. Create an account first.',
      );
      Navigator.pushNamed(
        context,
        AppRoutes.register,
        arguments: _registrationArguments(studentId, student),
      );
      return;
    }

    Navigator.pushNamed(
      context,
      AppRoutes.login,
      arguments: {
        'prefillStudentId': studentId,
        'focusPassword': true,
        'prefillFirstName': student['first_name'],
        'prefillLastName': student['last_name'],
        'student': student,
      },
    );
  }

  Future<void> _goToRegistration() async {
    final result = await _lookupStudent();
    if (result == null || !mounted) return;

    final student =
        (result['student'] as Map?)?.cast<String, dynamic>() ?? {};
    final studentId = result['fullStudentId']?.toString() ?? '';

    if (result['hasAccount'] == true) {
      _showMessage('An account already exists. Log in instead.');
      Navigator.pushNamed(
        context,
        AppRoutes.login,
        arguments: {
          'prefillStudentId': studentId,
          'focusPassword': true,
          'prefillFirstName': student['first_name'],
          'prefillLastName': student['last_name'],
          'student': student,
        },
      );
      return;
    }

    Navigator.pushNamed(
      context,
      AppRoutes.register,
      arguments: _registrationArguments(studentId, student),
    );
  }

  Map<String, dynamic> _registrationArguments(
    String studentId,
    Map<String, dynamic> student,
  ) {
    return {
      'student': student,
      'prefillStudentId': student['pdm_id'] ?? studentId,
      'prefillEmail': student['email_address'] ?? '',
      'isStudentIdReadOnly': true,
    };
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  void dispose() {
    _studentIdController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isCheckingSession) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8F5F0),
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8F5F0),
      body: SafeArea(
        child: Stack(
          children: [
            Positioned(
              top: -70,
              right: -80,
              child: _Orb(
                size: 230,
                color: AppColors.gold.withOpacity(0.24),
              ),
            ),
            Positioned(
              top: 145,
              left: -110,
              child: _Orb(
                size: 250,
                color: AppColors.brown.withOpacity(0.07),
              ),
            ),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 30),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 540),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(26),
                        decoration: BoxDecoration(
                          color: AppColors.darkBrown,
                          borderRadius: BorderRadius.circular(30),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.darkBrown.withOpacity(0.20),
                              blurRadius: 34,
                              offset: const Offset(0, 18),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            Image.asset(
                              'assets/images/school_logo.png',
                              height: 112,
                              fit: BoxFit.contain,
                            ),
                            const SizedBox(height: 18),
                            const Text(
                              'Scholarship access,\nmade simpler.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 30,
                                height: 1.12,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              'Use your official PDM Student ID to log in or create an account.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.72),
                                height: 1.45,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                      Container(
                        padding: const EdgeInsets.fromLTRB(22, 24, 22, 22),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(28),
                          border: Border.all(
                            color: AppColors.gold.withOpacity(0.24),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.06),
                              blurRadius: 28,
                              offset: const Offset(0, 14),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Text(
                              'Student ID',
                              style: TextStyle(
                                color: AppColors.darkBrown,
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 18),
                            TextField(
                              controller: _studentIdController,
                              keyboardType: TextInputType.number,
                              inputFormatters: const [
                                StudentIdInputFormatter(),
                              ],
                              decoration: InputDecoration(
                                prefixText: 'PDM-',
                                hintText: '0000-000000',
                                errorText: _error,
                                prefixIcon:
                                    const Icon(Icons.badge_rounded),
                                filled: true,
                                fillColor: const Color(0xFFFAF8F4),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(18),
                                  borderSide: BorderSide.none,
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(18),
                                  borderSide: BorderSide(
                                    color: AppColors.gold.withOpacity(0.24),
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(18),
                                  borderSide: const BorderSide(
                                    color: AppColors.brown,
                                    width: 1.6,
                                  ),
                                ),
                              ),
                              onChanged: (_) {
                                if (_error != null) {
                                  setState(() => _error = null);
                                }
                              },
                            ),
                            const SizedBox(height: 18),
                            SizedBox(
                              height: 52,
                              child: FilledButton(
                                onPressed:
                                    _isLookingUp ? null : _goToLogin,
                                style: FilledButton.styleFrom(
                                  backgroundColor: AppColors.gold,
                                  foregroundColor: AppColors.darkBrown,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(17),
                                  ),
                                ),
                                child: _isLookingUp
                                    ? const SizedBox(
                                        width: 22,
                                        height: 22,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: AppColors.darkBrown,
                                        ),
                                      )
                                    : const Text(
                                        'Log in',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              height: 52,
                              child: OutlinedButton(
                                onPressed:
                                    _isLookingUp ? null : _goToRegistration,
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: AppColors.darkBrown,
                                  side: const BorderSide(
                                    color: AppColors.brown,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(17),
                                  ),
                                ),
                                child: const Text(
                                  'Create account',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                      const Text(
                        'Accounts are available only to students found in the official PDM registry.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Color(0xFF7C746C),
                          fontSize: 12,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Orb extends StatelessWidget {
  const _Orb({
    required this.size,
    required this.color,
  });

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}
