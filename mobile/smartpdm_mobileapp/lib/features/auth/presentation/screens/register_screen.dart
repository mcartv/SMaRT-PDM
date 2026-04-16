import 'dart:async';

import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/auth_service.dart';
import 'package:smartpdm_mobileapp/shared/widgets/shared_widgets.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
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

  static const String _termsOfServiceText = '''
Welcome to SMaRT-PDM.

By creating and using a SMaRT-PDM account, you agree to provide truthful, complete, and updated information for scholarship-related purposes. You are responsible for protecting your login credentials and for all activity performed under your account.

You agree not to:
• submit false, altered, or misleading information
• impersonate another student or user
• upload fraudulent, incomplete, or unrelated documents
• misuse the platform for purposes outside legitimate scholarship application, tracking, communication, and account management
• attempt unauthorized access to other accounts, records, or restricted system functions

SMaRT-PDM may restrict, suspend, or terminate access if submitted information is found to be fraudulent, abusive, misleading, or in violation of school, scholarship, or system-use policies.

Using SMaRT-PDM does not guarantee scholarship approval. All scholarship decisions remain subject to verification, screening, availability of slots, compliance with requirements, and official approval by the proper offices or benefactors.

By continuing, you acknowledge that SMaRT-PDM is a student support and scholarship management platform, and that your use of the service must remain lawful, accurate, and consistent with institutional policies.
''';

  static const String _privacyStatementText = '''
SMaRT-PDM collects and processes information such as your student ID, email address, mobile number, profile details, uploaded records, and scholarship-related data to support account creation, identity verification, application processing, status tracking, communication, and scholarship administration.

Your information may be used for:
• registration and account authentication
• OTP and security verification
• applicant profile creation and maintenance
• scholarship application review and document verification
• notifications, updates, and system communications
• reporting and student support operations related to scholarship management

Your data is used only for legitimate school and scholarship administration purposes. Reasonable safeguards are applied to help protect stored information, but users are also responsible for maintaining account confidentiality and ensuring submitted information is accurate.

By creating an account, you acknowledge that your information may be stored, reviewed, and processed for these purposes within the SMaRT-PDM system.
''';

  final AuthService _authService = AuthService();
  final _formKey = GlobalKey<FormState>();

  final _identifierController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _acceptedPolicies = false;
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

  void _showPolicyModal({
    required String title,
    required String content,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
          ),
          child: SafeArea(
            top: false,
            child: DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.78,
              minChildSize: 0.55,
              maxChildSize: 0.95,
              builder: (context, controller) {
                return Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 46,
                          height: 5,
                          decoration: BoxDecoration(
                            color: Colors.grey.shade400,
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      Text(
                        title,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 14),
                      Expanded(
                        child: SingleChildScrollView(
                          controller: controller,
                          child: Text(
                            content,
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey.shade800,
                              height: 1.6,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () => Navigator.of(context).pop(),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: accentColor,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(borderRadius),
                            ),
                          ),
                          child: const Text(
                            'CLOSE',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }

  Future<void> _handleRegister() async {
    if (!_acceptedPolicies) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'You must agree to the Terms of Service and Privacy Statement first.',
          ),
        ),
      );
      return;
    }

    if (_formKey.currentState!.validate()) {
      setState(() => _isLoading = true);

      try {
        final identifier = _identifierController.text.trim();

        final registration = await _authService.register(
          email: _emailController.text.trim().toLowerCase(),
          password: _passwordController.text,
          studentId: identifier,
        );

        if (!mounted) return;

        Navigator.pushNamed(
          context,
          AppRoutes.otp,
          arguments: {
            'email': _emailController.text.trim().toLowerCase(),
            'user_id': registration.userId,
            'student_id': registration.studentId,
          },
        );
      } on TimeoutException {
        if (!mounted) return;

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Request timed out. Please check your connection or try again.',
            ),
          ),
        );
      } catch (e) {
        if (!mounted) return;

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      } finally {
        if (mounted) {
          setState(() => _isLoading = false);
        }
      }
    }
  }

  Widget _buildPolicyAgreement() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _acceptedPolicies
              ? accentColor.withOpacity(0.45)
              : Colors.grey.shade300,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Checkbox(
            value: _acceptedPolicies,
            onChanged: (value) {
              setState(() {
                _acceptedPolicies = value ?? false;
              });
            },
            activeColor: accentColor,
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    children: [
                      Text(
                        'I have read and agree to the ',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade800,
                          height: 1.5,
                        ),
                      ),
                      GestureDetector(
                        onTap: () => _showPolicyModal(
                          title: 'Terms of Service',
                          content: _termsOfServiceText,
                        ),
                        child: const Text(
                          'Terms of Service',
                          style: TextStyle(
                            color: Colors.orange,
                            fontWeight: FontWeight.w600,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ),
                      Text(
                        ' and the ',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade800,
                          height: 1.5,
                        ),
                      ),
                      GestureDetector(
                        onTap: () => _showPolicyModal(
                          title: 'SMaRT-PDM Privacy Statement',
                          content: _privacyStatementText,
                        ),
                        child: const Text(
                          'SMaRT-PDM Privacy Statement',
                          style: TextStyle(
                            color: Colors.orange,
                            fontWeight: FontWeight.w600,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ),
                      Text(
                        '.',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade800,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'This agreement is required before creating your account.',
                    style: TextStyle(
                      fontSize: 12,
                      color: _acceptedPolicies
                          ? Colors.green.shade700
                          : Colors.red.shade400,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
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
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Sign up to apply for and manage your SMaRT-PDM scholarships.',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey.shade600,
                    ),
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
                            _obscureConfirmPassword =
                                !_obscureConfirmPassword;
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

                  const SizedBox(height: 20),
                  _buildPolicyAgreement(),
                  const SizedBox(height: 20),

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
                        : Opacity(
                            opacity: _acceptedPolicies ? 1 : 0.6,
                            child: IgnorePointer(
                              ignoring: !_acceptedPolicies,
                              child: GoldButton(
                                label: 'Sign Up',
                                onTap: _handleRegister,
                              ),
                            ),
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
                        onPressed: () => Navigator.pushReplacementNamed(
                          context,
                          AppRoutes.login,
                        ),
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
