import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';

/// Simplified "Forgot Password" screen.
///
/// Requirements from user:
/// - delete the current complex multi-step flow
/// - make it simple and straightforward
/// - use app theme colors
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({
    super.key,
    this.recoveryService,
    this.captchaService,
  });

  // Kept for backward compatibility with existing tests/routes.
  final dynamic recoveryService;
  final dynamic captchaService;


  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();

  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _identifierController.dispose();
    super.dispose();
  }

  bool _isValidIdentifier(String value) {
    final v = value.trim();
    if (v.isEmpty) return false;

    if (v.contains('@')) {
      return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v);
    }

    // Mobile format used in app: 09XXXXXXXXX
    return RegExp(r'^09\d{9}$').hasMatch(v);
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    final id = _identifierController.text.trim();
    final isValid = _isValidIdentifier(id);

    if (!isValid) {
      setState(() => _error = 'Enter a valid email or mobile number.');
      return;
    }

    // This simplified flow only navigates to the OTP screen.
    // Your OTP verification implementation may currently assume email.
    // If you later wire the recovery endpoints, replace this navigation.
    final email = id.contains('@') ? id : null;

    if (email == null) {
      setState(() => _error = 'Mobile recovery is not connected yet. Use email for now.');
      return;
    }

    setState(() {
      _error = null;
      _isLoading = true;
    });

    try {
      if (!mounted) return;
      Navigator.pushNamed(
        context,
        AppRoutes.otp,
        arguments: {'email': email},
      );
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor,
      appBar: AppBar(
        backgroundColor: backgroundColor,
        elevation: 0,
        foregroundColor: textColor,
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
                      'Enter your email or mobile number. We will send a verification code.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: mutedColor,
                      ),
                    ),
                    const SizedBox(height: 20),

                    TextFormField(
                      controller: _identifierController,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.done,
                      decoration: InputDecoration(
                        labelText: 'Email or mobile number',
                        hintText: 'e.g. name@example.com or 09XXXXXXXXX',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(borderRadius),
                        ),
                      ),
                      validator: (v) {
                        final value = v ?? '';
                        if (value.trim().isEmpty) {
                          return 'This field is required.';
                        }
                        if (!_isValidIdentifier(value)) {
                          return 'Enter a valid email or mobile number.';
                        }
                        return null;
                      },
                      onFieldSubmitted: (_) => _submit(),
                    ),

                    const SizedBox(height: 20),

                    SizedBox(
                      height: 52,
                      child: FilledButton(
                        onPressed: _isLoading ? null : _submit,
                        style: FilledButton.styleFrom(
                          backgroundColor: primaryColor,
                          foregroundColor: pdmWhite,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                height: 22,
                                width: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  color: Colors.white,
                                ),
                              )
                            : Text(
                                'Send code',
                                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                      ),
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

