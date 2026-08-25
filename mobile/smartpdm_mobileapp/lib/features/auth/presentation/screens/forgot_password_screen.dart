import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/password_reset_service.dart';
import 'package:smartpdm_mobileapp/shared/widgets/shared_widgets.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({
    super.key,
    PasswordResetService? passwordResetService,
  }) : _passwordResetService = passwordResetService;

  final PasswordResetService? _passwordResetService;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  late final PasswordResetService _passwordResetService =
      widget._passwordResetService ?? PasswordResetService();

  final _formKey = GlobalKey<FormState>();
  final _studentIdController = TextEditingController();

  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _studentIdController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _error = null;
      _isLoading = true;
    });

    try {
      final studentId = PasswordResetService.normalizeStudentId(
        _studentIdController.text,
      );
      final message = await _passwordResetService.forgotPassword(studentId);

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );

      Navigator.pushNamed(
        context,
        AppRoutes.resetPasswordOtp,
        arguments: {'studentId': studentId},
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
        title: const Text('Reset Password'),
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
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
                      'Forgot your password?',
                      style: Theme.of(context).textTheme.displayLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Enter your Student ID and we will send password reset instructions to your registered email address.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: mutedColor,
                      ),
                    ),
                    const SizedBox(height: 20),
                    TextFormField(
                      controller: _studentIdController,
                      textCapitalization: TextCapitalization.characters,
                      textInputAction: TextInputAction.done,
                      decoration: InputDecoration(
                        labelText: 'Student ID',
                        hintText: 'PDM-2024-000123',
                        prefixIcon: const Icon(Icons.school_outlined),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(borderRadius),
                        ),
                      ),
                      validator: (value) {
                        final trimmed = (value ?? '').trim();
                        if (trimmed.isEmpty) {
                          return 'Student ID is required.';
                        }
                        if (!PasswordResetService.isValidStudentId(trimmed)) {
                          return 'Please enter a valid Student ID (e.g., PDM-2024-000123)';
                        }
                        return null;
                      },
                      onFieldSubmitted: (_) => _submit(),
                    ),
                    const SizedBox(height: 20),
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
                          : GoldButton(label: 'Send Instructions', onTap: _submit),
                    ),
                    const SizedBox(height: 14),
                    TextButton(
                      onPressed: () {
                        Navigator.pushNamedAndRemoveUntil(
                          context,
                          AppRoutes.login,
                          (route) => false,
                        );
                      },
                      child: const Text('Back to login'),
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
