// SMaRT-PDM: Authentication — password reset service (mobile service); calls APIs or shared services and returns processed results.
import 'package:smartpdm_mobileapp/core/networking/api_client.dart';

class PasswordResetService {
  PasswordResetService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  static final studentIdRegex = RegExp(r'^PDM-\d{4}-\d{6}$');

  static String normalizeStudentId(String value) => value.trim().toUpperCase();

  static bool isValidStudentId(String value) {
    return studentIdRegex.hasMatch(normalizeStudentId(value));
  }

  // forgotPassword: handles forgot password for the Authentication flow.
  Future<String> forgotPassword(String studentId) async {
    final response = await _apiClient.postJson(
      '/api/auth/forgot-password',
      body: {'studentId': normalizeStudentId(studentId)},
    );

    return response['message']?.toString() ??
        'If an account exists, password reset instructions have been sent.';
  }

  // verifyResetOtp: verifies verify reset otp for the Authentication flow.
  Future<String> verifyResetOtp({
    required String studentId,
    required String otp,
  }) async {
    final response = await _apiClient.postJson(
      '/api/auth/verify-reset-otp',
      body: {'studentId': normalizeStudentId(studentId), 'otp': otp.trim()},
    );

    return response['message']?.toString() ?? 'Verification successful.';
  }

  // resetPassword: resets reset password for the Authentication flow.
  Future<String> resetPassword({
    required String studentId,
    required String otp,
    required String password,
    required String confirmPassword,
  }) async {
    final response = await _apiClient.postJson(
      '/api/auth/reset-password',
      body: {
        'studentId': normalizeStudentId(studentId),
        'otp': otp.trim(),
        'password': password,
        'confirmPassword': confirmPassword,
      },
    );

    return response['message']?.toString() ?? 'Password reset successful.';
  }
}
