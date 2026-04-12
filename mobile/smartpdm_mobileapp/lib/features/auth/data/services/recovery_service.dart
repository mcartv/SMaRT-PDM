import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/features/auth/data/models/recovery_models.dart';

class RecoveryService {
  RecoveryService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  static String normalizeLookupIdentifier(String value) {
    final trimmed = value.trim();
    if (trimmed.contains('@')) {
      return trimmed.toLowerCase();
    }

    final cleaned = trimmed.replaceAll(RegExp(r'[^\d+]'), '');
    if (cleaned.startsWith('+63') && cleaned.length == 13) {
      return '0${cleaned.substring(3)}';
    }
    if (cleaned.startsWith('63') && cleaned.length == 12) {
      return '0${cleaned.substring(2)}';
    }
    if (cleaned.startsWith('9') && cleaned.length == 10) {
      return '0$cleaned';
    }
    return cleaned;
  }

  static bool isValidLookupIdentifier(String value) {
    final normalized = normalizeLookupIdentifier(value);
    if (normalized.contains('@')) {
      return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(normalized);
    }

    return RegExp(r'^09\d{9}$').hasMatch(normalized);
  }

  Future<List<RecoveryAccount>> lookupRecoveryAccounts(
    String identifier,
  ) async {
    final response = await _apiClient.postJson(
      '/api/auth/recovery/lookup',
      body: {'identifier': normalizeLookupIdentifier(identifier)},
    );

    final rawAccounts = response['accounts'];
    if (rawAccounts is! List<dynamic>) {
      return const [];
    }

    return rawAccounts
        .whereType<Map<String, dynamic>>()
        .map(RecoveryAccount.fromJson)
        .toList();
  }

  Future<RecoverySession> startRecovery({
    required String userId,
    required RecoveryChannel channel,
    required String captchaToken,
  }) async {
    final response = await _apiClient.postJson(
      '/api/auth/recovery/start',
      body: {
        'user_id': userId,
        'channel': channel.wireValue,
        'captcha_token': captchaToken,
      },
    );

    return RecoverySession.fromJson(response);
  }

  Future<RecoverySession> resendRecoveryCode(String sessionId) async {
    final response = await _apiClient.postJson(
      '/api/auth/recovery/resend-code',
      body: {'session_id': sessionId},
    );

    return RecoverySession.fromJson(response);
  }

  Future<PasswordResetGrant> verifyRecoveryCode({
    required String sessionId,
    required String code,
  }) async {
    final response = await _apiClient.postJson(
      '/api/auth/recovery/verify-code',
      body: {'session_id': sessionId, 'code': code.trim()},
    );

    return PasswordResetGrant.fromJson(response);
  }

  Future<void> resetRecoveredPassword({
    required String resetToken,
    required String newPassword,
  }) async {
    await _apiClient.postJson(
      '/api/auth/recovery/reset-password',
      body: {'reset_token': resetToken, 'new_password': newPassword},
    );
  }
}
