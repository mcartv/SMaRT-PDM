import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/services/auth_service.dart';
import 'package:smartpdm_mobileapp/widgets/shared_widgets.dart';
import 'package:url_launcher/url_launcher.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  static final Uri _termsUri = Uri.parse('https://smart-pdm.vercel.app/terms');
  static final Uri _privacyUri = Uri.parse(
    'https://smart-pdm.vercel.app/privacy',
  );
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

  final AuthService _authService = AuthService();
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _emailPreferences = false;
  bool _isLoading = false;

  @override
  void dispose() {
    _identifierController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  String? _validatePassword(String? value) {
    final password = value ?? '';
    if (password.isEmpty) {
      return 'Please enter a password';
    }

    final hasLongLength = password.length >= 15;
    final hasStrongMixedRule =
        password.length >= 8 &&
        RegExp(r'[a-z]').hasMatch(password) &&
        RegExp(r'\d').hasMatch(password);

    if (!hasLongLength && !hasStrongMixedRule) {
      return 'Password should be at least 15 characters OR at least 8 characters including a number and a lowercase letter.';
    }

    if (_commonPasswords.contains(password.toLowerCase())) {
      return 'Password may be compromised. Password is in a list of passwords commonly used on other websites.';
    }

    return null;
  }

  Future<void> _openLink(Uri uri) async {
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not open ${uri.toString()}')),
      );
    }
  }

  Future<void> _handleRegister() async {
    if (_formKey.currentState!.validate()) {
      setState(() => _isLoading = true);

      try {
        final identifier = _identifierController.text.trim();

        final registration = await _authService.register(
          email: _emailController.text.trim().toLowerCase(),
          password: _passwordController.text,
          studentId: identifier,
        );

        if (mounted) {
          Navigator.pushNamed(
            context,
            '/otp',
            arguments: {
              'email': _emailController.text.trim().toLowerCase(),
              'nextRoute': '/new_applicant',
              'user_id': registration.userId,
              'student_id': registration.studentId,
            },
          );
        }
      } on TimeoutException {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Request timed out. Please check your connection or try again.',
              ),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(e.toString())));
        }
      } finally {
        if (mounted) {
          setState(() => _isLoading = false);
        }
      }
    }
  }

  void _handleGoogleSignUp() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Google Sign-In coming soon!')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Image.asset(
                    'assets/images/school_logo.png',
                    height: 120,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Create an Account',
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Sign up to apply for and manage your SMaRT-PDM scholarships.',
                    style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),
                  TextFormField(
                    controller: _identifierController,
                    decoration: const InputDecoration(
                      labelText: 'Student ID',
                      prefixIcon: Icon(Icons.school_outlined),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter your Student ID';
                      }
                      final studentIdRegex = RegExp(r'^PDM-\d{4}-\d{6}$');
                      final identifier = value.trim();
                      if (!studentIdRegex.hasMatch(identifier)) {
                        return 'Invalid format. Student ID must be in the format PDM-YYYY-NNNNNN (e.g., PDM-2023-000001).';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Email Address',
                      prefixIcon: Icon(Icons.email_outlined),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter your email';
                      }
                      final email = value.trim();
                      final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
                      if (!emailRegex.hasMatch(email)) {
                        return 'Please enter a valid email';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      helperText:
                          'Use 15+ chars, or 8+ with a number and lowercase letter.',
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off
                              : Icons.visibility,
                        ),
                        onPressed: () {
                          setState(() {
                            _obscurePassword = !_obscurePassword;
                          });
                        },
                      ),
                    ),
                    validator: _validatePassword,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _confirmPasswordController,
                    obscureText: _obscureConfirmPassword,
                    decoration: InputDecoration(
                      labelText: 'Confirm Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscureConfirmPassword
                              ? Icons.visibility_off
                              : Icons.visibility,
                        ),
                        onPressed: () {
                          setState(() {
                            _obscureConfirmPassword = !_obscureConfirmPassword;
                          });
                        },
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please confirm your password';
                      }
                      if (value != _passwordController.text) {
                        return 'Passwords do not match';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _emailPreferences,
                    controlAffinity: ListTileControlAffinity.leading,
                    onChanged: (value) {
                      setState(() {
                        _emailPreferences = value ?? false;
                      });
                    },
                    title: const Text(
                      'Receive occasional product updates and announcements',
                    ),
                  ),
                  const SizedBox(height: 8),
                  RichText(
                    textAlign: TextAlign.left,
                    text: TextSpan(
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.grey.shade700,
                        height: 1.5,
                      ),
                      children: [
                        const TextSpan(
                          text: 'By creating an account, you agree to the ',
                        ),
                        TextSpan(
                          text: 'Terms of Service',
                          style: const TextStyle(
                            color: Colors.orange,
                            fontWeight: FontWeight.w600,
                            decoration: TextDecoration.underline,
                          ),
                          recognizer: TapGestureRecognizer()
                            ..onTap = () => _openLink(_termsUri),
                        ),
                        const TextSpan(
                          text:
                              '. For more information about SMaRT-PDM\'s privacy practices, see the ',
                        ),
                        TextSpan(
                          text: 'SMaRT-PDM Privacy Statement',
                          style: const TextStyle(
                            color: Colors.orange,
                            fontWeight: FontWeight.w600,
                            decoration: TextDecoration.underline,
                          ),
                          recognizer: TapGestureRecognizer()
                            ..onTap = () => _openLink(_privacyUri),
                        ),
                        const TextSpan(
                          text:
                              '. We\'ll occasionally send you account-related emails.',
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: _isLoading
                        ? const Center(
                            child: SizedBox(
                              height: 24,
                              width: 24,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        : GoldButton(label: 'Sign Up', onTap: _handleRegister),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      const Expanded(child: Divider()),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0),
                        child: Text(
                          'OR',
                          style: TextStyle(color: Colors.grey.shade600),
                        ),
                      ),
                      const Expanded(child: Divider()),
                    ],
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: GhostButton(
                      label: 'Sign up with Google',
                      icon: Image.asset('assets/images/google.png', height: 20),
                      onTap: _handleGoogleSignUp,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'Already have an account? ',
                        style: TextStyle(color: Colors.grey.shade700),
                      ),
                      TextButton(
                        onPressed: () =>
                            Navigator.pushReplacementNamed(context, '/login'),
                        child: const Text(
                          'Login',
                          style: TextStyle(fontWeight: FontWeight.bold),
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
    );
  }
}
