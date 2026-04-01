import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'dart:io'; // Import for SocketException
import 'package:http/http.dart' as http;
import 'package:smartpdm_mobileapp/constants.dart'; // Assuming you have your colors here based on main.dart



class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  // Combined controller for Student ID or Username
  final _identifierController = TextEditingController(); // This controller will hold the combined input
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _termsAccepted = false;
  bool _privacyAccepted = false;
  bool _isLoading = false;

  @override
  void dispose() {
    _identifierController.dispose(); // Dispose the combined controller

    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    if (_formKey.currentState!.validate()) {
      setState(() => _isLoading = true);

      try {
        // Note: 10.0.2.2 points to localhost on the Android Emulator.
        // Use your PC's local IP address if testing on a physical device.
        final url = Uri.parse('$BASE_URL/api/auth/register');
        
        Map<String, dynamic> authBody = {
          'email': _emailController.text.trim(),
          'password': _passwordController.text,
        };

        // Define regex for automatic identification
        final studentIdRegex = RegExp(r'^PDM-\d{4}-\d{6}$'); // Example: PDM-2023-000001 (Student ID format)
        final identifier = _identifierController.text.trim();

        // Debug prints to understand identifier processing
        debugPrint('DEBUG (Flutter): Identifier input: "$identifier"');
        debugPrint('DEBUG (Flutter): Matches studentIdRegex: ${studentIdRegex.hasMatch(identifier)}');

        // Always treat the input as a Student ID
        authBody['student_id'] = identifier;
        authBody['username'] = null; // Explicitly send null for username
        debugPrint('DEBUG (Flutter): Identifier treated as Student ID.');

        debugPrint('DEBUG (Flutter): Auth Body being sent: ${jsonEncode(authBody)}');

        final response = await http.post(
          url, headers: {
            'Content-Type': 'application/json'
          }, body: jsonEncode(authBody),
        ).timeout(const Duration(seconds: 15));

        if (response.statusCode == 200 || response.statusCode == 201) {
          if (mounted) {
            // Pass the email as an argument to the OTP screen
            Navigator.pushNamed(context, '/otp', arguments: {
              'email': _emailController.text,
              'nextRoute': '/new_applicant', // Direct to new applicant flow after OTP
            });
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Registration failed: ${response.body}')),
            );
          }
        }
      } on TimeoutException {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Request timed out. Please check your connection or try again.')),
          );
        }
      } on SocketException catch (e) {
        if (mounted) {
          debugPrint('Registration Socket Error: $e');
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Network connection error. Please check your internet connection.')),
          );
        }
      } on http.ClientException catch (e) {
        if (mounted) {
          debugPrint('Registration HTTP Client Error: $e');
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Connection error. Please ensure your backend is running and accessible.')),
          );
        }
      } catch (e) {
        if (mounted) {
          debugPrint('Registration Unexpected Error: $e');
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('An unexpected error occurred: ${e.toString()}')),
          );
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
                  // Header text
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

                  // Dynamic Identifier Field
                  TextFormField(
                    controller: _identifierController, // Use the combined controller
                    decoration: const InputDecoration(
                      labelText: 'Student ID', // Specific label
                      prefixIcon: Icon(Icons.school_outlined), // Specific icon
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

                  // Email Field
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Email Address',
                      prefixIcon: Icon(Icons.email_outlined),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your email';
                      }
                      if (!value.contains('@')) {
                        return 'Please enter a valid email';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Password Field
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword ? Icons.visibility_off : Icons.visibility,
                        ),
                        onPressed: () {
                          setState(() {
                            _obscurePassword = !_obscurePassword;
                          });
                        },
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter a password';
                      }
                      if (value.length < 6) {
                        return 'Password must be at least 6 characters';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Confirm Password Field
                  TextFormField(
                    controller: _confirmPasswordController,
                    obscureText: _obscureConfirmPassword,
                    decoration: InputDecoration(
                      labelText: 'Confirm Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscureConfirmPassword ? Icons.visibility_off : Icons.visibility,
                        ),
                        onPressed: () {
                          setState(() {
                            _obscureConfirmPassword = !_obscureConfirmPassword;
                          });
                        },
                      ),
                    ),
                    validator: (value) {
                      if (value != _passwordController.text) {
                        return 'Passwords do not match';
                        }
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),

                  // Sign Up Button
                  ElevatedButton(
                      onPressed: _handleRegister,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                  color: Colors.white, strokeWidth: 2))
                          : const Text('SIGN UP',
                              style: TextStyle(
                                  fontSize: 16, fontWeight: FontWeight.bold))),
                  const SizedBox(height: 16),

                  // Terms and Privacy Agreement Checkboxes
                  Row(
                    children: [
                      Checkbox(
                        value: _termsAccepted,
                        onChanged: (bool? value) {
                          setState(() {
                            _termsAccepted = value!;
                          });
                        },
                      ),
                      const Text('I agree to the Terms of Service'),
                    ],
                  ),
                  Row(
                    children: [
                      Checkbox(
                        value: _privacyAccepted,
                        onChanged: (bool? value) {
                          setState(() {
                            _privacyAccepted = value!;
                          });
                        },
                      ),
                      const Text('I agree to the Privacy Policy'),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Or Divider
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

                  // Google Sign Up Button
                  OutlinedButton.icon(
                    onPressed: _handleGoogleSignUp,
                    icon: const Icon(Icons.g_mobiledata, size: 32),
                    label: const Text('Sign up with Google', style: TextStyle(fontSize: 16)),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      foregroundColor: Colors.black87,
                      side: BorderSide(color: Colors.grey.shade300),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Navigate to Login
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'Already have an account? ',
                        style: TextStyle(color: Colors.grey.shade700),
                      ),
                      TextButton(
                        onPressed: () {
                          // Navigate back to login screen
                          Navigator.pop(context);
                        },
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
