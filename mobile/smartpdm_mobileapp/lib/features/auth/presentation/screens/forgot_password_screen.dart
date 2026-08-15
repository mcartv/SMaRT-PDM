import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/password_reset_service.dart';
import 'package:smartpdm_mobileapp/shared/formatters/student_id_input_formatter.dart';
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

  final SessionService _sessionService = const SessionService();
  final _formKey = GlobalKey<FormState>();
  final _studentIdController = TextEditingController();

  bool _isLoading = false;
  bool _isSignedIn = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    final session = await _sessionService.getCurrentUser();
    final isSignedIn = await _sessionService.isSessionValid();

    if (!mounted) return;

    final digits = StudentIdInputFormatter.stripPdmPrefix(session.studentId);
    if (digits.isNotEmpty) {
      _studentIdController.text = StudentIdInputFormatter.formatVisible(digits);
    }

    setState(() => _isSignedIn = isSignedIn);
  }

  @override
  void dispose() {
    _studentIdController.dispose();
    super.dispose();
  }

  String get _fullStudentId =>
      StudentIdInputFormatter.toFullStudentId(_studentIdController.text);

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _error = null;
      _isLoading = true;
    });

    try {
      final studentId = _fullStudentId;
      final message = await _passwordResetService.forgotPassword(studentId);

      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));

      Navigator.pushNamed(
        context,
        AppRoutes.resetPasswordOtp,
        arguments: {'studentId': studentId, 'returnToAccount': _isSignedIn},
      );
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Unable to send reset instructions. Try again.',
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _goBack() {
    if (Navigator.of(context).canPop()) {
      Navigator.pop(context);
      return;
    }

    Navigator.pushNamedAndRemoveUntil(
      context,
      _isSignedIn ? AppRoutes.home : AppRoutes.login,
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final background = isDark
        ? const Color(0xFF24180F)
        : const Color(0xFFF8F5F0);
    final cardColor = isDark ? const Color(0xFF302116) : Colors.white;
    final textColor = isDark ? Colors.white : AppColors.darkBrown;
    final muted = isDark ? Colors.white70 : Colors.grey.shade700;

    return Scaffold(
      backgroundColor: background,
      appBar: AppBar(
        backgroundColor: background,
        elevation: 0,
        foregroundColor: textColor,
        leading: IconButton(
          onPressed: _goBack,
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        title: const Text('Reset Password'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Container(
                padding: const EdgeInsets.fromLTRB(24, 30, 24, 26),
                decoration: BoxDecoration(
                  color: cardColor,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.28),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 26,
                      offset: const Offset(0, 14),
                    ),
                  ],
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(
                        width: 64,
                        height: 64,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: AppColors.darkBrown,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Icon(
                          Icons.lock_reset_rounded,
                          color: AppColors.gold,
                          size: 34,
                        ),
                      ),
                      const SizedBox(height: 22),
                      Text(
                        'Forgot your password?',
                        style: Theme.of(context).textTheme.headlineMedium
                            ?.copyWith(
                              color: textColor,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Enter your Student ID. We will send a verification code to your registered email address.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: muted,
                          height: 1.45,
                        ),
                      ),
                      const SizedBox(height: 22),
                      if (_error != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.red.withValues(alpha: 0.08),
                            border: Border.all(color: Colors.red.shade300),
                            borderRadius: BorderRadius.circular(14),
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
                        const SizedBox(height: 16),
                      ],
                      TextFormField(
                        controller: _studentIdController,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.done,
                        inputFormatters: const <TextInputFormatter>[
                          StudentIdInputFormatter(),
                        ],
                        decoration: InputDecoration(
                          labelText: 'Student ID *',
                          hintText: '2024-000123',
                          prefixIcon: const Padding(
                            padding: EdgeInsets.only(left: 14, right: 8),
                            child: Center(
                              widthFactor: 1,
                              child: Text(
                                'PDM-',
                                style: TextStyle(fontWeight: FontWeight.w800),
                              ),
                            ),
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        validator: (_) =>
                            StudentIdInputFormatter.validationMessage(
                              _studentIdController.text,
                            ),
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
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                  ),
                                ),
                              )
                            : GoldButton(
                                label: 'Send Verification Code',
                                onTap: _submit,
                              ),
                      ),
                      const SizedBox(height: 12),
                      TextButton(
                        onPressed: _goBack,
                        child: Text(
                          _isSignedIn ? 'Back to account' : 'Back to login',
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
