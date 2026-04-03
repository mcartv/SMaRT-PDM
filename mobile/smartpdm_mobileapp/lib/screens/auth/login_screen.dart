import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'dart:io'; // Import for SocketException
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/constants.dart'; // Assuming you have your colors here based on main.dart
import 'package:smartpdm_mobileapp/widgets/shared_widgets.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _studentIdController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _studentIdController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (_formKey.currentState!.validate()) {
      setState(() => _isLoading = true);

      try {
        // Note: 10.0.2.2 points to localhost on the Android Emulator.
        // Use your PC's local IP address if testing on a physical device.
        final url = Uri.parse('$BASE_URL/api/auth/login');

        final response = await http
            .post(
              url,
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({
                'student_id': _studentIdController.text.trim(),
                'password': _passwordController.text,
              }),
            )
            .timeout(const Duration(seconds: 15));

        if (response.statusCode == 200) {
          final responseData =
              jsonDecode(response.body) as Map<String, dynamic>;
          final user = (responseData['user'] as Map<String, dynamic>?) ?? {};
          final prefs = await SharedPreferences.getInstance();

          await prefs.setString(
            'jwt_token',
            responseData['token']?.toString() ?? '',
          );
          await prefs.setString('user_id', user['user_id']?.toString() ?? '');
          await prefs.setString('user_email', user['email']?.toString() ?? '');
          await prefs.setString(
            'user_student_id',
            user['student_id']?.toString() ?? '',
          );

          if (mounted) {
            Navigator.pushReplacementNamed(context, '/home');
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Login failed: ${response.body}')),
            );
          }
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
      } on SocketException catch (e) {
        if (mounted) {
          print('Login Socket Error: $e');
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Network connection error. Please check your internet connection.',
              ),
            ),
          );
        }
      } on http.ClientException catch (e) {
        // Catch specific HTTP client errors (e.g., connection refused)
        if (mounted) {
          print('Login HTTP Client Error: $e');
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Connection error. Please ensure your backend is running and accessible.',
              ),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          print(
            'Login Unexpected Error: $e',
          ); // Catch all other unexpected errors (like routing errors)
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('An unexpected error occurred: ${e.toString()}'),
            ),
          );
        }
      } finally {
        if (mounted) {
          setState(() => _isLoading = false);
        }
      }
    }
  }

  void _handleGoogleSignIn() {
    // TODO: Implement Google Sign-In logic later
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
                  // Logo
                  Image.asset(
                    'assets/images/school_logo.png',
                    height: 120,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(height: 16),
                  // Header text
                  const Text(
                    'Welcome Back!',
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Login to your SMaRT-PDM account.',
                    style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),

                  // Student ID Field
                  TextFormField(
                    controller: _studentIdController,
                    keyboardType:
                        TextInputType.text, // Student ID can be alphanumeric
                    decoration: const InputDecoration(
                      labelText: 'Student ID',
                      prefixIcon: Icon(Icons.school_outlined),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter your Student ID';
                      }
                      final studentIdRegex = RegExp(r'^PDM-\d{4}-\d{6}$');
                      if (!studentIdRegex.hasMatch(value.trim())) {
                        return 'Invalid Student ID format (e.g., PDM-YYYY-NNNNNN)';
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
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your password';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Forgot Password
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () {
                        Navigator.pushNamed(context, '/forgot-password');
                      },
                      child: const Text('Forgot Password?'),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Login Button (Gold)
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
                        : GoldButton(label: 'Login', onTap: _handleLogin),
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

                  // Google Sign Up Button (Ghost)
                  SizedBox(
                    width: double.infinity,
                    child: GhostButton(
                      label: 'Sign up with Google',
                      icon: Image.asset('assets/images/google.png', height: 20),
                      onTap: _handleGoogleSignIn,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Navigate to Register
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        "Don't have an account? ",
                        style: TextStyle(color: Colors.grey.shade700),
                      ),
                      TextButton(
                        onPressed: () => Navigator.pushReplacementNamed(
                          context,
                          '/register',
                        ),
                        child: const Text(
                          'Register',
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
