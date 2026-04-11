import 'package:flutter/foundation.dart';
import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';

class AuthResult {
  final String token;
  final String userId;
  final String email;
  final String studentId;
  final String firstName;
  final String lastName;

  const AuthResult({
    required this.token,
    required this.userId,
    required this.email,
    required this.studentId,
    this.firstName = '',
    this.lastName = '',
  });
}

class RegistrationResult {
  final String userId;
  final String studentId;

  const RegistrationResult({required this.userId, required this.studentId});
}

class AuthService {
  AuthService({ApiClient? apiClient, SessionService? sessionService})
    : _apiClient = apiClient ?? ApiClient(),
      _sessionService = sessionService ?? const SessionService();

  final ApiClient _apiClient;
  final SessionService _sessionService;

  Future<RegistrationResult> register({
    required String email,
    required String password,
    required String studentId,
  }) async {
    final response = await _apiClient.postJson(
      '/api/auth/register',
      body: {
        'email': email.trim(),
        'password': password,
        'student_id': studentId.trim(),
      },
    );

    final user = (response['user'] as Map<String, dynamic>?) ?? {};
    return RegistrationResult(
      userId: user['user_id']?.toString() ?? '',
      studentId: user['student_id']?.toString() ?? studentId.trim(),
    );
  }

  Future<AuthResult> verifyOtp({
    required String email,
    required String otp,
  }) async {
    final response = await _apiClient.postJson(
      '/api/auth/verify-otp',
      body: {'email': email.trim(), 'otp': otp.trim()},
    );

    return await _saveAndBuildAuthResult(response);
  }

  Future<void> resendOtp(String email) async {
    await _apiClient.postJson(
      '/api/auth/resend-otp',
      body: {'email': email.trim()},
    );
  }

  Future<AuthResult> login({
    required String studentId,
    required String password,
  }) async {
    final response = await _apiClient.postJson(
      '/api/auth/login',
      body: {'student_id': studentId.trim(), 'password': password},
    );

    return await _saveAndBuildAuthResult(response);
  }

  Future<void> requestPasswordReset(String email) async {
    await _apiClient.postJson(
      '/api/auth/forgot-password',
      body: {'email': email.trim()},
    );
  }

  Future<AuthResult> _saveAndBuildAuthResult(
    Map<String, dynamic> response,
  ) async {
    final user = (response['user'] as Map<String, dynamic>?) ?? {};
    final result = AuthResult(
      token: response['token']?.toString() ?? '',
      userId: user['user_id']?.toString() ?? '',
      email: user['email']?.toString() ?? '',
      studentId: user['student_id']?.toString() ?? '',
      firstName: user['first_name']?.toString() ?? '',
      lastName: user['last_name']?.toString() ?? '',
    );

    await _sessionService.saveAuthSession(
      token: result.token,
      userId: result.userId,
      email: result.email,
      studentId: result.studentId,
      firstName: result.firstName,
      lastName: result.lastName,
      isVerified: user['is_verified'] == true,
      role: user['role']?.toString(),
    );

    final session = await _sessionService.getCurrentUser();
    debugPrint('JWT: ${session.token}');
    debugPrint('Stored user_id: ${session.userId}');
    debugPrint('Stored student_id: ${session.studentId}');

    return result;
  }
}
