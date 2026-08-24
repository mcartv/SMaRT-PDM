import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/email_change_service.dart';
import 'package:smartpdm_mobileapp/shared/validation/app_field_validators.dart';

class ChangeEmailScreen extends StatefulWidget {
  const ChangeEmailScreen({super.key});

  @override
  State<ChangeEmailScreen> createState() => _ChangeEmailScreenState();
}

class _ChangeEmailScreenState extends State<ChangeEmailScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final SessionService _sessionService = const SessionService();
  final EmailChangeService _emailChangeService = EmailChangeService();

  bool _isLoading = false;
  String _currentEmail = '';
  String? _requestId;
  String? _pendingEmail;
  String? _message;
  String? _error;
  int _resendSeconds = 0;
  Timer? _timer;

  bool get _isOtpStep => (_requestId ?? '').isNotEmpty;

  @override
  void initState() {
    super.initState();
    _prefillEmail();
  }

  Future<void> _prefillEmail() async {
    final session = await _sessionService.getCurrentUser();
    if (!mounted) return;
    setState(() {
      _currentEmail = session.email;
      _emailController.text = session.email;
    });
  }

  void _startCooldown(int seconds) {
    _timer?.cancel();
    setState(() => _resendSeconds = seconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _resendSeconds <= 1) {
        timer.cancel();
        if (mounted) setState(() => _resendSeconds = 0);
        return;
      }
      setState(() => _resendSeconds -= 1);
    });
  }

  Future<void> _requestCode() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
      _message = null;
    });

    try {
      final request = await _emailChangeService.requestEmailChange(
        _emailController.text,
      );

      if (!mounted) return;
      setState(() {
        _requestId = request.requestId;
        _pendingEmail = request.newEmail;
        _message = request.message;
        _otpController.clear();
      });
      _startCooldown(request.resendCooldownSeconds);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Unable to send the verification code. Try again.',
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _verifyCode() async {
    FocusScope.of(context).unfocus();

    if (_otpController.text.trim().length != 6) {
      setState(() => _error = 'Enter the complete 6-digit verification code.');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
      _message = null;
    });

    try {
      final newEmail = await _emailChangeService.verifyEmailChange(
        requestId: _requestId!,
        otp: _otpController.text,
      );

      await _sessionService.saveProfileCache(email: newEmail);

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Email address changed successfully.'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context, newEmail);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Unable to verify the code. Try again.');
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _changeEnteredEmail() {
    _timer?.cancel();
    setState(() {
      _requestId = null;
      _pendingEmail = null;
      _otpController.clear();
      _message = null;
      _error = null;
      _resendSeconds = 0;
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _emailController.dispose();
    _otpController.dispose();
    super.dispose();
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
        title: const Text('Change Email'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Container(
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 26),
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
                        child: Icon(
                          _isOtpStep
                              ? Icons.mark_email_read_rounded
                              : Icons.alternate_email_rounded,
                          color: AppColors.gold,
                          size: 34,
                        ),
                      ),
                      const SizedBox(height: 22),
                      Text(
                        _isOtpStep
                            ? 'Verify your new email'
                            : 'Update your email address',
                        style: Theme.of(context).textTheme.headlineMedium
                            ?.copyWith(
                              color: textColor,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _isOtpStep
                            ? 'Enter the 6-digit code sent to ${_pendingEmail ?? ''}. Your database email will change only after verification.'
                            : 'Enter a new email address. We will send a verification code to that address before changing your account.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: muted,
                          height: 1.45,
                        ),
                      ),
                      if (_currentEmail.isNotEmpty && !_isOtpStep) ...[
                        const SizedBox(height: 14),
                        Text(
                          'Current email: $_currentEmail',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: muted,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                      ],
                      const SizedBox(height: 22),
                      if (_error != null) ...[
                        _StatusBox(message: _error!, isError: true),
                        const SizedBox(height: 14),
                      ],
                      if (_message != null) ...[
                        _StatusBox(message: _message!, isError: false),
                        const SizedBox(height: 14),
                      ],
                      if (!_isOtpStep) ...[
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.done,
                          autocorrect: false,
                          decoration: InputDecoration(
                            labelText: 'New Email Address *',
                            hintText: 'name@example.com',
                            prefixIcon: const Icon(Icons.email_outlined),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          validator: (value) =>
                              AppFieldValidators.differentEmail(
                                value,
                                currentEmail: _currentEmail,
                              ),
                          onFieldSubmitted: (_) => _requestCode(),
                        ),
                        const SizedBox(height: 20),
                        SizedBox(
                          height: 52,
                          child: ElevatedButton(
                            onPressed: _isLoading ? null : _requestCode,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.gold,
                              foregroundColor: AppColors.darkBrown,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: _isLoading
                                ? const SizedBox(
                                    height: 21,
                                    width: 21,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.4,
                                    ),
                                  )
                                : const Text(
                                    'Send Verification Code',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                          ),
                        ),
                      ] else ...[
                        TextFormField(
                          controller: _otpController,
                          keyboardType: TextInputType.number,
                          textInputAction: TextInputAction.done,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(6),
                          ],
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 25,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 8,
                          ),
                          decoration: InputDecoration(
                            labelText: 'Verification Code *',
                            hintText: '000000',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          onFieldSubmitted: (_) => _verifyCode(),
                        ),
                        const SizedBox(height: 20),
                        SizedBox(
                          height: 52,
                          child: ElevatedButton(
                            onPressed: _isLoading ? null : _verifyCode,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.gold,
                              foregroundColor: AppColors.darkBrown,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: _isLoading
                                ? const SizedBox(
                                    height: 21,
                                    width: 21,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.4,
                                    ),
                                  )
                                : const Text(
                                    'Verify and Change Email',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        TextButton(
                          onPressed: _isLoading || _resendSeconds > 0
                              ? null
                              : _requestCode,
                          child: Text(
                            _resendSeconds > 0
                                ? 'Resend code in ${_resendSeconds}s'
                                : 'Resend verification code',
                          ),
                        ),
                        TextButton(
                          onPressed: _isLoading ? null : _changeEnteredEmail,
                          child: const Text('Use a different email'),
                        ),
                      ],
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

class _StatusBox extends StatelessWidget {
  const _StatusBox({required this.message, required this.isError});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color = isError ? Colors.red : Colors.green;
    final textColor = isError
        ? (isDark ? Colors.red.shade200 : Colors.red.shade800)
        : (isDark ? Colors.green.shade200 : Colors.green.shade800);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        border: Border.all(color: color.withValues(alpha: 0.5)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Text(
        message,
        style: TextStyle(color: textColor, fontWeight: FontWeight.w600),
      ),
    );
  }
}
