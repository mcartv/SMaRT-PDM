// SMaRT-PDM: Authentication — reset password screen (mobile screen); loads state, handles user actions, and renders the screen.
import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/password_reset_service.dart';
import 'package:smartpdm_mobileapp/shared/validation/app_field_validators.dart';
import 'package:smartpdm_mobileapp/shared/widgets/password_strength_indicator.dart';
import 'package:smartpdm_mobileapp/shared/widgets/shared_widgets.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({
    super.key,
    PasswordResetService? passwordResetService,
  }) : _passwordResetService = passwordResetService;

  final PasswordResetService? _passwordResetService;

  @override
  // createState: creates create state for the Authentication flow.
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  // SMART-PDM_MOBILE_AUTH_RESET_PASSWORD_POLISH_PHASE2_6_V1
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
  // dispose: handles dispose for the Authentication flow.
  void dispose() {
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  // _getArgs: handles get args for the Authentication flow.
  Map<String, String>? _getArgs() {
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is Map) {
      return args.map(
        (key, value) => MapEntry(key.toString(), value.toString()),
      );
    }
    return null;
  }

  // _getStudentId: handles get student id for the Authentication flow.
  String? _getStudentId() {
    final args = _getArgs();
    final studentId = args?['studentId']?.trim();
    if (studentId == null || studentId.isEmpty) return null;
    return PasswordResetService.normalizeStudentId(studentId);
  }

  // _getOtp: handles get otp for the Authentication flow.
  String? _getOtp() {
    final args = _getArgs();
    final otp = args?['otp']?.trim();
    if (otp == null || otp.isEmpty) return null;
    return otp;
  }

  // _validatePassword: handles validate password for the Authentication flow.
  String? _validatePassword(String? value) {
    return AppFieldValidators.password(value);
  }

  // _validateConfirmPassword: handles validate confirm password for the Authentication flow.
  String? _validateConfirmPassword(String? value) {
    return AppFieldValidators.confirmPassword(
      value,
      password: _passwordController.text,
    );
  }

  // _submit: handles submit for the Authentication flow.
  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    final studentId = _getStudentId();
    final otp = _getOtp();

    if (studentId == null || otp == null) {
      setState(
        () => _error = 'Session expired. Please start the reset process again.',
      );
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

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));

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
  // build: builds build for the Authentication flow.
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedText = isDark
        ? AppColors.applicantDarkTextMuted
        : Colors.grey.shade700;
    final cardColor = isDark ? AppColors.applicantDarkSurface : Colors.white;
    final headingColor = isDark ? AppColors.applicantDarkText : textColor;
    final textScale = MediaQuery.textScalerOf(context).scale(1);
    final isCompact =
        MediaQuery.sizeOf(context).width < 360 || textScale > 1.15;

    return Scaffold(
      backgroundColor: isDark
          ? AppColors.applicantDarkBackground
          : backgroundColor,
      appBar: AppBar(
        backgroundColor: isDark
            ? AppColors.applicantDarkBackground
            : backgroundColor,
        elevation: 0,
        foregroundColor: isDark ? Colors.white : textColor,
        title: const Text('New Password'),
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: SingleChildScrollView(
              padding: EdgeInsets.all(isCompact ? 14 : 18),
              child: Container(
                padding: EdgeInsets.all(isCompact ? 18 : 24),
                decoration: BoxDecoration(
                  color: cardColor,
                  borderRadius: BorderRadius.circular(isCompact ? 22 : 26),
                  border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.24),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(
                        alpha: isDark ? 0.22 : 0.06,
                      ),
                      blurRadius: 24,
                      offset: const Offset(0, 12),
                    ),
                  ],
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_error != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.red.withValues(alpha: 0.08),
                            border: Border.all(color: Colors.red.shade300),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            _error!,
                            style: TextStyle(
                              color: isDark
                                  ? Colors.red.shade200
                                  : Colors.red.shade900,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],
                      Text(
                        'Create a new password',
                        style: Theme.of(context).textTheme.headlineMedium
                            ?.copyWith(
                              color: headingColor,
                              fontSize: isCompact ? 25 : 28,
                              fontWeight: FontWeight.w900,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Choose a strong password that meets all requirements below.',
                        style: Theme.of(
                          context,
                        ).textTheme.bodyMedium?.copyWith(color: mutedText),
                      ),
                      const SizedBox(height: 20),
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        textInputAction: TextInputAction.next,
                        decoration: InputDecoration(
                          labelText: 'New Password *',
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
                              setState(
                                () => _obscurePassword = !_obscurePassword,
                              );
                            },
                          ),
                        ),
                        validator: _validatePassword,
                        onChanged: (_) => setState(() {}),
                      ),
                      const SizedBox(height: 12),
                      PasswordStrengthIndicator(
                        password: _passwordController.text,
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _confirmPasswordController,
                        obscureText: _obscureConfirmPassword,
                        textInputAction: TextInputAction.done,
                        decoration: InputDecoration(
                          labelText: 'Confirm Password *',
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
                                () => _obscureConfirmPassword =
                                    !_obscureConfirmPassword,
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
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                  ),
                                ),
                              )
                            : GoldButton(
                                label: 'Reset Password',
                                onTap: _submit,
                              ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
