import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'dart:io'; // Import for SocketException
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/constants.dart';

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
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
    for (var controller in _controllers) {
      controller.dispose();
    }
    for (var node in _focusNodes) {
      node.dispose();
    }
    _cooldownTimer?.cancel();
    super.dispose();
  }

  void _startCooldown() {
    setState(() => _resendCooldown = 60);
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_resendCooldown > 0) {
        setState(() {
          _resendCooldown--;
        });
      } else {
        timer.cancel();
      }
    });
  }

  Future<void> _verifyOtp() async {
    if (_formKey.currentState!.validate()) {
      final otp = _controllers.map((c) => c.text).join();
      if (otp.length < 6) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please enter all 6 digits of the OTP.'),
          ),
        );
        return;
      }

      setState(() => _isLoading = true);

      // Retrieve the email passed from the registration screen
      final args =
          ModalRoute.of(context)?.settings.arguments as Map<String, String>?;
      final email = args?['email'];
      final nextRoute =
          args?['nextRoute'] ??
          '/new_applicant'; // Default to /new_applicant if nextRoute is not provided

      try {
        final url = Uri.parse('$BASE_URL/api/auth/verify-otp');
        final response = await http
            .post(
              url,
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({'email': email ?? '', 'otp': otp}),
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
          await prefs.setString(
            'user_id',
            user['user_id']?.toString() ?? args?['user_id'] ?? '',
          );
          await prefs.setString(
            'user_email',
            user['email']?.toString() ?? email ?? '',
          );
          await prefs.setString(
            'user_student_id',
            user['student_id']?.toString() ?? args?['student_id'] ?? '',
          );

          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Email Verified Successfully!')),
            );
            Navigator.pushReplacementNamed(
              context,
              nextRoute,
            ); // Navigate to the specified nextRoute
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Invalid OTP. Please try again.')),
            );
          }
        }
      } on TimeoutException {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Request timed out. Server might be down.'),
            ),
          );
        }
      } on SocketException catch (e) {
        if (mounted) {
          print('OTP Verify Socket Error: $e');
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Network connection error. Please try again.'),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          print('OTP Verify HTTP Client Error: $e');
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Connection error. Please try again.'),
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

  Future<void> _resendOtp() async {
    if (_resendCooldown > 0) return;

    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, String>?;
    final email = args?['email'];

    if (email == null) return;

    try {
      final url = Uri.parse('$BASE_URL/api/auth/resend-otp');
      await http
          .post(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'email': email}),
          )
          .timeout(const Duration(seconds: 15));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('OTP Resent! Check your email.')),
        );
        _startCooldown();
      }
    } on TimeoutException {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Request timed out. Server might be down.'),
          ),
        );
      }
    } catch (e) {
      print('OTP Resend Network Error: $e'); // Added debug print
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Failed to resend OTP.')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.transparent,
        iconTheme: const IconThemeData(color: Colors.black),
      ),
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
                    'Verify Your Account',
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Enter the 6-digit OTP sent to your email address.',
                    style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),

                  // OTP Input Fields
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: List.generate(6, (index) {
                      return SizedBox(
                        width: 45,
                        height: 55,
                        child: TextFormField(
                          controller: _controllers[index],
                          focusNode: _focusNodes[index],
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.center,
                          inputFormatters: [
                            LengthLimitingTextInputFormatter(6),
                            FilteringTextInputFormatter.digitsOnly,
                          ],
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                          decoration: InputDecoration(
                            counterText: '',
                            contentPadding: EdgeInsets.zero,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(borderRadius),
                            ),
                          ),
                          onChanged: (value) {
                            if (value.length > 1) {
                              // Handle copy-paste string across multiple boxes
                              for (
                                int i = 0;
                                i < value.length && (index + i) < 6;
                                i++
                              ) {
                                _controllers[index + i].text = value[i];
                              }
                              // Move focus to the appropriate next node or dismiss keyboard
                              int nextFocusIndex = index + value.length;
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
                              _focusNodes[index]
                                  .unfocus(); // Dismiss keyboard when done
                            }
                          },
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 32),

                  // Verify Button
                  ElevatedButton(
                    onPressed: _isLoading ? null : _verifyOtp,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Text(
                            'VERIFY',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                  const SizedBox(height: 24),

                  // Resend OTP
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
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
