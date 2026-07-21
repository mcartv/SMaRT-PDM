import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/password_reset_service.dart';
import 'package:smartpdm_mobileapp/shared/widgets/password_strength_indicator.dart';
import 'package:smartpdm_mobileapp/shared/widgets/shared_widgets.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({
    super.key,
    PasswordResetService? passwordResetService,
  }) : _passwordResetService = passwordResetService;

  final PasswordResetService? _passwordResetService;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  static const Set<String> _commonPasswords = {
    '12345678',
    '123456789',
    '1234567890',
    'password',
    'password1',
    'password123',
    'qwerty123',
    'admin123',
    'welcome123',
    'iloveyou',
    'abc12345',
    'letmein123',
    'p@ssw0rd',
  };

  late final PasswordResetService _passwordResetService =
      widget._passwordResetService ?? PasswordResetService();

  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Map<String, String>? _getArgs() {
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is Map) {
      return args.map((key, value) => MapEntry(key.toString(), value.toString()));
    }
    return null;
  }

  String? _getStudentId() {
    final args = _getArgs();
    final studentId = args?['studentId']?.trim();
    if (studentId == null || studentId.isEmpty) return null;
    return PasswordResetService.normalizeStudentId(studentId);
  }

  String? _getOtp() {
    final args = _getArgs();
    final otp = args?['otp']?.trim();
    if (otp == null || otp.isEmpty) return null;
    return otp;
  }

  bool _meetsPasswordPolicy(String password) {
    if (password.length < 8) return false;
    if (!RegExp(r'[a-z]').hasMatch(password)) return false;
    if (!RegExp(r'[A-Z]').hasMatch(password)) return false;
    if (!RegExp(r'\d').hasMatch(password)) return false;
    if (_commonPasswords.contains(password.toLowerCase())) return false;
    return true;
  }

  String? _validatePassword(String? value) {
    final password = value ?? '';
    if (password.isEmpty) {
      return 'Password is required.';
    }
    if (!_meetsPasswordPolicy(password)) {
      return 'Password must be at least 8 characters with uppercase, lowercase, and a number.';
    }
    return null;
  }

  String? _validateConfirmPassword(String? value) {
    final confirm = value ?? '';
    if (confirm.isEmpty) {
      return 'Please confirm your password.';
    }
    if (confirm != _passwordController.text) {
      return 'Passwords do not match.';
    }
    return null;
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    final studentId = _getStudentId();
    final otp = _getOtp();

    if (studentId == null || otp == null) {
      setState(() => _error = 'Session expired. Please start the reset process again.');
      return;
    }

    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _error = null;
      _isLoading = true;
    });

    try {
      final message = await _passwordResetService.resetPassword(
        studentId: studentId,
        otp: otp,
        password: _passwordController.text,
        confirmPassword: _confirmPasswordController.text,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );

      Navigator.pushNamedAndRemoveUntil(
        context,
        AppRoutes.login,
        (route) => false,
      );
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF24180F) : backgroundColor,
      appBar: AppBar(
        backgroundColor: isDark ? const Color(0xFF24180F) : backgroundColor,
        elevation: 0,
        foregroundColor: isDark ? Colors.white : textColor,
        title: const Text('New Password'),
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_error != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.withOpacity(0.08),
                          border: Border.all(color: Colors.red.shade300),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          _error!,
                          style: TextStyle(
                            color: Colors.red.shade900,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    Text(
                      'Create a new password',
                      style: Theme.of(context).textTheme.displayLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Choose a strong password that meets all requirements below.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: mutedColor,
                      ),
                    ),
                    const SizedBox(height: 20),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: 'New Password',
                        prefixIcon: const Icon(Icons.lock_outline),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(borderRadius),
                        ),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                          ),
                          onPressed: () {
                            setState(() => _obscurePassword = !_obscurePassword);
                          },
                        ),
                      ),
                      validator: _validatePassword,
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 12),
                    PasswordStrengthIndicator(password: _passwordController.text),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _confirmPasswordController,
                      obscureText: _obscureConfirmPassword,
                      textInputAction: TextInputAction.done,
                      decoration: InputDecoration(
                        labelText: 'Confirm Password',
                        prefixIcon: const Icon(Icons.lock_outline),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(borderRadius),
                        ),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscureConfirmPassword
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                          ),
                          onPressed: () {
                            setState(
                              () => _obscureConfirmPassword = !_obscureConfirmPassword,
                            );
                          },
                        ),
                      ),
                      validator: _validateConfirmPassword,
                      onFieldSubmitted: (_) => _submit(),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      height: 52,
                      child: _isLoading
                          ? const Center(
                              child: SizedBox(
                                height: 22,
                                width: 22,
                                child: CircularProgressIndicator(strokeWidth: 2.5),
                              ),
                            )
                          : GoldButton(label: 'Reset Password', onTap: _submit),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
