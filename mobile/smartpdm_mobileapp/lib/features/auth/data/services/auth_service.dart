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
  final bool hasScholarAccess;

  const AuthResult({
    required this.token,
    required this.userId,
    required this.email,
    required this.studentId,
    this.firstName = '',
    this.lastName = '',
    this.hasScholarAccess = false,
  });
}

class RegistrationResult {
  final String userId;
  final String studentId;
  final String email;
  final String message;

  const RegistrationResult({
    required this.userId,
    required this.studentId,
    required this.email,
    required this.message,
  });
}

class CourseOption {
  final String courseId;
  final String courseCode;
  final String courseName;
  final String label;

  const CourseOption({
    required this.courseId,
    required this.courseCode,
    required this.courseName,
    required this.label,
  });

  factory CourseOption.fromJson(Map<String, dynamic> json) {
    final courseCode = (json['course_code']?.toString() ?? '').trim();
    final courseName = (json['course_name']?.toString() ?? '').trim();

    return CourseOption(
      courseId: json['course_id']?.toString() ?? '',
      courseCode: courseCode,
      courseName: courseName,
      label: (json['label']?.toString() ?? '').trim().isNotEmpty
          ? json['label'].toString().trim()
          : '$courseCode - $courseName',
    );
  }
}

class AuthService {
  AuthService({ApiClient? apiClient, SessionService? sessionService})
    : _apiClient = apiClient ?? ApiClient(),
      _sessionService = sessionService ?? const SessionService();

  final ApiClient _apiClient;
  final SessionService _sessionService;

  Future<Map<String, dynamic>> checkStudentId(String studentId) async {
    return _apiClient.postJson(
      '/api/auth/check-student-id',
      body: {'student_id': studentId.trim().toUpperCase()},
    );
  }

  Future<RegistrationResult> register({
    required String email,
    required String password,
    required String studentId,
  }) async {
    final response = await _apiClient.postJson(
      '/api/auth/register',
      body: {
        'email': email.trim().toLowerCase(),
        'password': password,
        'student_id': studentId.trim().toUpperCase(),
      },
    );

    final user = (response['user'] as Map<String, dynamic>?) ?? {};

    return RegistrationResult(
      userId: user['user_id']?.toString() ?? '',
      studentId: user['student_id']?.toString() ?? studentId.trim(),
      email: user['email']?.toString() ?? email.trim().toLowerCase(),
      message: response['message']?.toString() ?? 'OTP sent.',
    );
  }

  Future<AuthResult> verifyOtp({
    required String email,
    required String otp,
  }) async {
    final response = await _apiClient.postJson(
      '/api/auth/verify-otp',
      body: {'email': email.trim().toLowerCase(), 'otp': otp.trim()},
    );

    return _saveAndBuildAuthResult(response);
  }

  Future<AuthResult> login({
    required String studentId,
    required String password,
  }) async {
    final response = await _apiClient.postJson(
      '/api/auth/login',
      body: {
        'student_id': studentId.trim().toUpperCase(),
        'password': password,
      },
    );

    return _saveAndBuildAuthResult(response);
  }

  Future<void> resendOtp(String email) async {
    await _apiClient.postJson(
      '/api/auth/resend-otp',
      body: {'email': email.trim().toLowerCase()},
    );
  }

  Future<void> cancelRegistration(String email) async {
    await _apiClient.postJson(
      '/api/auth/cancel-registration',
      body: {'email': email.trim().toLowerCase()},
    );
  }

  Future<List<CourseOption>> fetchCourses() async {
    final response = await _apiClient.getObject('/api/courses');
    final items = response['items'] as List<dynamic>? ?? [];

    return items
        .map((item) => CourseOption.fromJson(item as Map<String, dynamic>))
        .toList();
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
      hasScholarAccess: user['has_scholar_access'] == true,
    );

    if (result.token.isEmpty) {
      throw Exception('No token returned from server.');
    }

    await _sessionService.saveAuthSession(
      token: result.token,
      userId: result.userId,
      email: result.email,
      studentId: result.studentId,
      firstName: result.firstName,
      lastName: result.lastName,
      isVerified: user['is_verified'] == true,
      hasScholarAccess: result.hasScholarAccess,
      role: user['role']?.toString(),
    );

    final session = await _sessionService.getCurrentUser();
    debugPrint('JWT: ${session.token}');
    debugPrint('Stored user_id: ${session.userId}');
    debugPrint('Stored student_id: ${session.studentId}');

    return result;
  }
}
