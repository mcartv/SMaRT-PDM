import 'package:smartpdm_mobileapp/core/networking/api_client.dart';

class EmailChangeRequest {
  const EmailChangeRequest({
    required this.requestId,
    required this.newEmail,
    required this.message,
    required this.expiresInSeconds,
    required this.resendCooldownSeconds,
  });

  final String requestId;
  final String newEmail;
  final String message;
  final int expiresInSeconds;
  final int resendCooldownSeconds;
}

class EmailChangeService {
  EmailChangeService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<EmailChangeRequest> requestEmailChange(String newEmail) async {
    final response = await _apiClient.postJson(
      '/api/auth/request-email-change',
      body: {'newEmail': newEmail.trim().toLowerCase()},
    );

    return EmailChangeRequest(
      requestId: response['requestId']?.toString() ?? '',
      newEmail:
          response['newEmail']?.toString() ?? newEmail.trim().toLowerCase(),
      message:
          response['message']?.toString() ??
          'A verification code was sent to the new email address.',
      expiresInSeconds:
          int.tryParse(response['expiresInSeconds']?.toString() ?? '') ?? 600,
      resendCooldownSeconds:
          int.tryParse(response['resendCooldownSeconds']?.toString() ?? '') ??
          60,
    );
  }

  Future<String> verifyEmailChange({
    required String requestId,
    required String otp,
  }) async {
    final response = await _apiClient.postJson(
      '/api/auth/verify-email-change',
      body: {'requestId': requestId, 'otp': otp.trim()},
    );

    return response['email']?.toString() ?? '';
  }
}
