// SMaRT-PDM: Authentication — reset password otp screen (mobile screen); loads state, handles user actions, and renders the screen.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/password_reset_service.dart';

class ResetPasswordOtpScreen extends StatefulWidget {
  const ResetPasswordOtpScreen({
    super.key,
    PasswordResetService? passwordResetService,
  }) : _passwordResetService = passwordResetService;

  final PasswordResetService? _passwordResetService;

  @override
  // createState: creates create state for the Authentication flow.
  State<ResetPasswordOtpScreen> createState() => _ResetPasswordOtpScreenState();
}

class _ResetPasswordOtpScreenState extends State<ResetPasswordOtpScreen> {
  // SMART-PDM_MOBILE_AUTH_RESET_OTP_POLISH_PHASE2_5_V1
  late final PasswordResetService _passwordResetService =
      widget._passwordResetService ?? PasswordResetService();

  final _formKey = GlobalKey<FormState>();
  final List<TextEditingController> _controllers = List.generate(
    6,
    (_) => TextEditingController(),
  );
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());

  bool _isLoading = false;
  int _resendCooldown = 60;
  Timer? _cooldownTimer;

  @override
  // initState: handles init state for the Authentication flow.
  void initState() {
    super.initState();
    _startCooldown();
  }

  @override
  // dispose: handles dispose for the Authentication flow.
  void dispose() {
    _cooldownTimer?.cancel();
    for (final controller in _controllers) {
      controller.dispose();
    }
    for (final node in _focusNodes) {
      node.dispose();
    }
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

  String get _otpValue => _controllers.map((c) => c.text.trim()).join();

  bool get _isOtpComplete => _otpValue.length == 6;

  // _showMessage: handles show message for the Authentication flow.
  void _showMessage(String text, {bool isError = false}) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(text),
        backgroundColor: isError ? Colors.red : null,
      ),
    );
  }

  // _startCooldown: handles start cooldown for the Authentication flow.
  void _startCooldown() {
    _cooldownTimer?.cancel();

    if (!mounted) return;
    setState(() => _resendCooldown = 60);

    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }

      if (_resendCooldown > 0) {
        setState(() => _resendCooldown--);
      } else {
        timer.cancel();
      }
    });
  }

  // _verifyOtp: handles verify otp for the Authentication flow.
  Future<void> _verifyOtp() async {
    FocusScope.of(context).unfocus();

    final studentId = _getStudentId();
    if (studentId == null) {
      _showMessage('Missing Student ID. Please start again.', isError: true);
      return;
    }

    if (!_formKey.currentState!.validate() || !_isOtpComplete) {
      _showMessage('Please enter the complete 6-digit OTP.', isError: true);
      return;
    }

    setState(() => _isLoading = true);

    try {
      await _passwordResetService.verifyResetOtp(
        studentId: studentId,
        otp: _otpValue,
      );

      if (!mounted) return;

      Navigator.pushNamed(
        context,
        AppRoutes.resetPassword,
        arguments: {'studentId': studentId, 'otp': _otpValue},
      );
    } on ApiException catch (e) {
      _showMessage(e.message, isError: true);
    } catch (e) {
      _showMessage(e.toString(), isError: true);
    } finally {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  // _resendOtp: handles resend otp for the Authentication flow.
  Future<void> _resendOtp() async {
    if (_resendCooldown > 0 || _isLoading) return;

    final studentId = _getStudentId();
    if (studentId == null) {
      _showMessage('Missing Student ID. Please start again.', isError: true);
      return;
    }

    setState(() => _isLoading = true);

    try {
      final message = await _passwordResetService.forgotPassword(studentId);
      _showMessage(message);
      _startCooldown();
    } on ApiException catch (e) {
      _showMessage(e.message, isError: true);
    } catch (e) {
      _showMessage(e.toString(), isError: true);
    } finally {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  // _validateOtpBox: handles validate otp box for the Authentication flow.
  String? _validateOtpBox(String? value) {
    final v = (value ?? '').trim();
    if (v.isEmpty) return '';
    if (!RegExp(r'^\d$').hasMatch(v)) return '';
    return null;
  }

  // _buildOtpBox: handles build otp box for the Authentication flow.
  Widget _buildOtpBox(int index, {required double height}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return SizedBox(
      height: height,
      child: TextFormField(
        controller: _controllers[index],
        focusNode: _focusNodes[index],
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        validator: _validateOtpBox,
        inputFormatters: [
          LengthLimitingTextInputFormatter(6),
          FilteringTextInputFormatter.digitsOnly,
        ],
        style: const TextStyle(
          fontSize: 26,
          height: 1,
          fontWeight: FontWeight.w700,
        ),
        decoration: InputDecoration(
          counterText: '',
          filled: true,
          fillColor: isDark
              ? AppColors.applicantDarkSurfaceMuted
              : Colors.white,
          contentPadding: EdgeInsets.zero,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(borderRadius),
            borderSide: BorderSide(
              color: isDark
                  ? AppColors.applicantDarkOutline
                  : Colors.grey.shade300,
            ),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(borderRadius),
            borderSide: BorderSide(
              color: isDark
                  ? AppColors.applicantDarkOutline
                  : Colors.grey.shade300,
            ),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(borderRadius),
            borderSide: BorderSide(color: accentColor, width: 1.6),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(borderRadius),
            borderSide: const BorderSide(color: Colors.red),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(borderRadius),
            borderSide: const BorderSide(color: Colors.red, width: 1.4),
          ),
        ),
        onChanged: (value) {
          if (value.length > 1) {
            for (int i = 0; i < value.length && (index + i) < 6; i++) {
              _controllers[index + i].text = value[i];
            }

            final nextFocusIndex = index + value.length;
            if (nextFocusIndex < 6) {
              _focusNodes[nextFocusIndex].requestFocus();
            } else {
              _focusNodes[5].unfocus();
            }
          } else if (value.isNotEmpty && index < 5) {
            _focusNodes[index + 1].requestFocus();
          } else if (value.isEmpty && index > 0) {
            _focusNodes[index - 1].requestFocus();
          } else if (value.isNotEmpty && index == 5) {
            _focusNodes[index].unfocus();
          }

          if (mounted) setState(() {});
        },
      ),
    );
  }

  // _buildOtpRow: handles build otp row for the Authentication flow.
  Widget _buildOtpRow() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isCompact = constraints.maxWidth < 270;
        final gap = isCompact ? 4.0 : 8.0;
        final boxHeight = isCompact ? 52.0 : 58.0;

        return Row(
          children: List.generate(11, (index) {
            if (index.isOdd) return SizedBox(width: gap);
            return Expanded(child: _buildOtpBox(index ~/ 2, height: boxHeight));
          }),
        );
      },
    );
  }

  @override
  // build: builds build for the Authentication flow.
  Widget build(BuildContext context) {
    final studentId = _getStudentId();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedText = isDark
        ? AppColors.applicantDarkTextMuted
        : Colors.grey.shade700;
    final textScale = MediaQuery.textScalerOf(context).scale(1);
    final isCompact =
        MediaQuery.sizeOf(context).width < 360 || textScale > 1.15;

    return Scaffold(
      backgroundColor: isDark
          ? AppColors.applicantDarkBackground
          : Colors.grey.shade50,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: isDark ? Colors.white : Colors.black,
        title: const Text('Verify Code'),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(
              horizontal: isCompact ? 16 : 24,
              vertical: 12,
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Container(
                padding: EdgeInsets.all(isCompact ? 18 : 24),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.applicantDarkSurface : Colors.white,
                  borderRadius: BorderRadius.circular(borderRadius * 1.4),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(
                        alpha: isDark ? 0.22 : 0.05,
                      ),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      CircleAvatar(
                        radius: 28,
                        backgroundColor: accentColor.withValues(alpha: 0.12),
                        child: Icon(
                          Icons.lock_reset_rounded,
                          color: accentColor,
                          size: 30,
                        ),
                      ),
                      const SizedBox(height: 18),
                      Text(
                        'Enter Reset Code',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineMedium
                            ?.copyWith(
                              fontSize: isCompact ? 25 : 28,
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        studentId == null
                            ? 'Enter the 6-digit code sent to your registered email address.'
                            : 'Enter the 6-digit code sent for $studentId.',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: mutedText,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 28),
                      _buildOtpRow(),
                      const SizedBox(height: 14),
                      Text(
                        'The code must be exactly 6 digits.',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.labelMedium
                            ?.copyWith(
                              color: isDark
                                  ? AppColors.applicantDarkTextMuted
                                  : Colors.grey.shade600,
                            ),
                      ),
                      const SizedBox(height: 24),
                      SizedBox(
                        height: 52,
                        child: ElevatedButton(
                          onPressed: (_isLoading || !_isOtpComplete)
                              ? null
                              : _verifyOtp,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: accentColor,
                            foregroundColor: AppColors.darkBrown,
                            disabledBackgroundColor: Colors.grey.shade300,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(borderRadius),
                            ),
                          ),
                          child: _isLoading
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    color: AppColors.darkBrown,
                                    strokeWidth: 2.2,
                                  ),
                                )
                              : Text(
                                  'Verify Code',
                                  style: Theme.of(context).textTheme.bodyLarge
                                      ?.copyWith(
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 0.3,
                                      ),
                                ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      Column(
                        children: [
                          Text(
                            "Didn't receive the code?",
                            style: TextStyle(color: mutedText),
                          ),
                          TextButton(
                            onPressed: _resendCooldown > 0 || _isLoading
                                ? null
                                : _resendOtp,
                            child: Text(
                              _resendCooldown > 0
                                  ? 'Resend in ${_resendCooldown}s'
                                  : 'Resend code',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: _resendCooldown > 0
                                    ? Colors.grey
                                    : accentColor,
                              ),
                            ),
                          ),
                        ],
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
