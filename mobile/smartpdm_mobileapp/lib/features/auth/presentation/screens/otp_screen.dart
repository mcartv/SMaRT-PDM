import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/auth_service.dart';
import 'complete_profile_screen.dart';

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final AuthService _authService = AuthService();
  final _formKey = GlobalKey<FormState>();

  final List<TextEditingController> _controllers = List.generate(
    6,
    (_) => TextEditingController(),
  );
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());

  bool _isLoading = false;
  int _resendCooldown = 0;
  Timer? _cooldownTimer;

  @override
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

  Map<String, String>? _getArgs() {
    return ModalRoute.of(context)?.settings.arguments as Map<String, String>?;
  }

  String? _getEmail() {
    final args = _getArgs();
    final email = args?['email']?.trim();
    if (email == null || email.isEmpty) return null;
    return email;
  }

  String get _otpValue => _controllers.map((c) => c.text.trim()).join();

  bool get _isOtpComplete => _otpValue.length == 6;

  void _showMessage(String text, {bool isError = false}) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(text),
        backgroundColor: isError ? Colors.red : null,
      ),
    );
  }

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
        setState(() {
          _resendCooldown--;
        });
      } else {
        timer.cancel();
      }
    });
  }

  Future<bool> _handleBackPress() async {
    final email = _getEmail();

    try {
      if (email != null) {
        await _authService.cancelRegistration(email);
      }
    } catch (_) {
      // Allow leaving even if cancel endpoint fails.
    }

    return true;
  }

  Future<void> _verifyOtp() async {
    FocusScope.of(context).unfocus();

    final email = _getEmail();
    if (email == null) {
      _showMessage('Missing email. Please register again.', isError: true);
      return;
    }

    if (!_formKey.currentState!.validate()) {
      _showMessage('Please enter the complete 6-digit OTP.', isError: true);
      return;
    }

    final otp = _otpValue;
    if (otp.length != 6) {
      _showMessage('Please enter the complete 6-digit OTP.', isError: true);
      return;
    }

    setState(() => _isLoading = true);

    try {
      await _authService.verifyOtp(email: email, otp: otp);

      if (!mounted) return;

      _showMessage('Email verified successfully!');

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => CompleteProfileScreen(),
        ),
      );
    } on TimeoutException {
      _showMessage('Request timed out. Server might be down.', isError: true);
    } catch (e) {
      _showMessage(e.toString(), isError: true);
    } finally {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  Future<void> _resendOtp() async {
    if (_resendCooldown > 0 || _isLoading) return;

    final email = _getEmail();
    if (email == null) {
      _showMessage('Missing email. Please register again.', isError: true);
      return;
    }

    try {
      await _authService.resendOtp(email);
      _showMessage('OTP resent! Check your email.');
      _startCooldown();
    } on TimeoutException {
      _showMessage('Request timed out. Server might be down.', isError: true);
    } catch (e) {
      _showMessage(e.toString(), isError: true);
    }
  }

  String? _validateOtpBox(String? value) {
    final v = (value ?? '').trim();

    if (v.isEmpty) return '';
    if (!RegExp(r'^\d$').hasMatch(v)) return '';

    return null;
  }

  Widget _buildOtpBox(int index) {
    return SizedBox(
      width: 46,
      height: 58,
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
          fontSize: 22,
          fontWeight: FontWeight.w700,
        ),
        decoration: InputDecoration(
          counterText: '',
          filled: true,
          fillColor: Colors.white,
          contentPadding: EdgeInsets.zero,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(borderRadius),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(borderRadius),
            borderSide: BorderSide(color: Colors.grey.shade300),
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

          if (mounted) {
            setState(() {});
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final email = _getEmail();

    return WillPopScope(
      onWillPop: _handleBackPress,
      child: Scaffold(
        backgroundColor: Colors.grey.shade50,
        appBar: AppBar(
          elevation: 0,
          backgroundColor: Colors.transparent,
          foregroundColor: Colors.black,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () async {
              final canLeave = await _handleBackPress();
              if (!mounted || !canLeave) return;
              Navigator.of(context).pop();
            },
          ),
        ),
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(borderRadius * 1.4),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
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
                          backgroundColor: accentColor.withOpacity(0.12),
                          child: Icon(
                            Icons.verified_user_rounded,
                            color: accentColor,
                            size: 30,
                          ),
                        ),
                        const SizedBox(height: 18),
                        const Text(
                          'Verify Your Account',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          email == null
                              ? 'Enter the 6-digit OTP sent to your email address.'
                              : 'Enter the 6-digit OTP sent to $email',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey.shade600,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 28),

                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: List.generate(6, _buildOtpBox),
                        ),

                        const SizedBox(height: 14),

                        Text(
                          'The code must be exactly 6 digits.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 12.5,
                            color: Colors.grey.shade600,
                          ),
                        ),

                        const SizedBox(height: 24),

                        SizedBox(
                          height: 52,
                          child: ElevatedButton(
                            onPressed:
                                (_isLoading || !_isOtpComplete) ? null : _verifyOtp,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: accentColor,
                              foregroundColor: Colors.white,
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
                                      color: Colors.white,
                                      strokeWidth: 2.2,
                                    ),
                                  )
                                : const Text(
                                    'VERIFY',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                          ),
                        ),

                        const SizedBox(height: 18),

                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              "Didn't receive the code? ",
                              style: TextStyle(color: Colors.grey.shade700),
                            ),
                            TextButton(
                              onPressed: _resendCooldown > 0 ? null : _resendOtp,
                              child: Text(
                                _resendCooldown > 0
                                    ? 'RESEND IN ${_resendCooldown}s'
                                    : 'RESEND',
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

                        const SizedBox(height: 4),

                        TextButton(
                          onPressed: _isLoading
                              ? null
                              : () async {
                                  final canLeave = await _handleBackPress();
                                  if (!mounted || !canLeave) return;
                                  Navigator.of(context).pop();
                                },
                          child: Text(
                            'Cancel registration',
                            style: TextStyle(
                              color: Colors.grey.shade700,
                              fontWeight: FontWeight.w600,
                            ),
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
      ),
    );
  }
}