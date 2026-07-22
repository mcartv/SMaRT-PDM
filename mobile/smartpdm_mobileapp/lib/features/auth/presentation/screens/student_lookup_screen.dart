import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/shared/formatters/student_id_input_formatter.dart';

class StudentLookupScreen extends StatefulWidget {
  final String? mode; // 'existing' or 'new'

  const StudentLookupScreen({super.key, this.mode});

  @override
  State<StudentLookupScreen> createState() => _StudentLookupScreenState();
}

class _StudentLookupScreenState extends State<StudentLookupScreen> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _studentIdFocus = FocusNode();

  bool _loading = false;
  String? _error;

  bool get _isExisting => widget.mode == 'existing';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _studentIdFocus.requestFocus();
    });
  }

  Future<void> _checkStudent() async {
    final studentId = StudentIdInputFormatter.toFullStudentId(_controller.text);

    if (studentId.isEmpty) {
      setState(() => _error = 'Enter your official Student ID.');
      return;
    }

    if (!RegExp(r'^PDM-\d{4}-\d{6}$').hasMatch(studentId)) {
      setState(() => _error = 'Use the format PDM-0000-000000.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final response = await ApiClient().postJson(
        '/api/auth/check-student-id',
        body: {'student_id': studentId},
      );

      final exists = response['exists'] == true;
      final hasAccount = response['hasAccount'] == true;
      final student =
          (response['student'] as Map?)?.cast<String, dynamic>() ?? {};

      if (!exists) {
        setState(() => _error = 'Student ID was not found in the registry.');
        return;
      }

      if (!mounted) return;

      if (_isExisting) {
        if (!hasAccount) {
          _showMessage(
            'No account is connected to this Student ID yet. Create an account first.',
          );
          Navigator.pushReplacementNamed(
            context,
            AppRoutes.register,
            arguments: _registrationArguments(studentId, student),
          );
          return;
        }

        Navigator.pushReplacementNamed(
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

      if (hasAccount) {
        _showMessage(
          'An account already exists for this Student ID. Log in instead.',
        );
        Navigator.pushReplacementNamed(
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

      Navigator.pushReplacementNamed(
        context,
        AppRoutes.register,
        arguments: _registrationArguments(studentId, student),
      );
    } catch (_) {
      setState(() => _error = 'Unable to connect to the server.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
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
    _controller.dispose();
    _studentIdFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final title = _isExisting ? 'Find your account' : 'Verify your student record';
    final subtitle = _isExisting
        ? 'Enter your Student ID first. We will carry it to the login screen so you only need to enter your password.'
        : 'Account registration starts with a registry check. Only verified PDM students can continue.';

    return Scaffold(
      backgroundColor: const Color(0xFFF8F5F0),
      body: SafeArea(
        child: Stack(
          children: [
            Positioned(
              top: -80,
              right: -70,
              child: _DecorativeCircle(
                size: 220,
                color: AppColors.gold.withOpacity(0.20),
              ),
            ),
            Positioned(
              bottom: -110,
              left: -80,
              child: _DecorativeCircle(
                size: 260,
                color: AppColors.brown.withOpacity(0.08),
              ),
            ),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 520),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Align(
                        alignment: Alignment.centerLeft,
                        child: IconButton.filledTonal(
                          onPressed: () => Navigator.maybePop(context),
                          icon: const Icon(Icons.arrow_back_rounded),
                          style: IconButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: AppColors.darkBrown,
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: AppColors.darkBrown,
                          borderRadius: BorderRadius.circular(28),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.darkBrown.withOpacity(0.18),
                              blurRadius: 30,
                              offset: const Offset(0, 16),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 58,
                              height: 58,
                              decoration: BoxDecoration(
                                color: AppColors.gold,
                                borderRadius: BorderRadius.circular(18),
                              ),
                              child: const Icon(
                                Icons.badge_rounded,
                                color: AppColors.darkBrown,
                                size: 30,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'SMaRT-PDM',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 20,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    _isExisting
                                        ? 'Secure account access'
                                        : 'Verified student registration',
                                    style: TextStyle(
                                      color: Colors.white.withOpacity(0.72),
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 22),
                      Container(
                        padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
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
                            Text(
                              title,
                              style: theme.textTheme.headlineMedium?.copyWith(
                                color: AppColors.darkBrown,
                                fontWeight: FontWeight.w800,
                                height: 1.08,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              subtitle,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: Colors.grey.shade700,
                                height: 1.5,
                              ),
                            ),
                            const SizedBox(height: 24),
                            TextField(
                              controller: _controller,
                              focusNode: _studentIdFocus,
                              keyboardType: TextInputType.number,
                              inputFormatters: const [
                                StudentIdInputFormatter(),
                              ],
                              textInputAction: TextInputAction.done,
                              onSubmitted: (_) => _checkStudent(),
                              decoration: InputDecoration(
                                labelText: 'Student ID',
                                prefixText: 'PDM-',
                                hintText: '0000-000000',
                                errorText: _error,
                                prefixIcon:
                                    const Icon(Icons.school_rounded),
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
                                onPressed: _loading ? null : _checkStudent,
                                style: FilledButton.styleFrom(
                                  backgroundColor: AppColors.gold,
                                  foregroundColor: AppColors.darkBrown,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(17),
                                  ),
                                ),
                                child: _loading
                                    ? const SizedBox(
                                        width: 22,
                                        height: 22,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: AppColors.darkBrown,
                                        ),
                                      )
                                    : Text(
                                        _isExisting
                                            ? 'Continue to Login'
                                            : 'Continue to Registration',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextButton(
                              onPressed: () => Navigator.pushReplacementNamed(
                                context,
                                _isExisting
                                    ? AppRoutes.studentLookup
                                    : AppRoutes.login,
                                arguments: _isExisting ? 'new' : null,
                              ),
                              child: Text(
                                _isExisting
                                    ? 'Create an account'
                                    : 'Already registered? Log in',
                                style: const TextStyle(
                                  color: AppColors.brown,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
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

class _DecorativeCircle extends StatelessWidget {
  const _DecorativeCircle({
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
