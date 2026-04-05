import 'package:smartpdm_mobileapp/services/api_client.dart';
import 'package:smartpdm_mobileapp/services/session_service.dart';

class ProfileService {
  ProfileService({ApiClient? apiClient, SessionService? sessionService})
    : _apiClient = apiClient ?? ApiClient(),
      _sessionService = sessionService ?? const SessionService();

  final ApiClient _apiClient;
  final SessionService _sessionService;

  Future<String> uploadAvatar({
    required String email,
    required String filePath,
  }) async {
    final response = await _apiClient.uploadFile(
      '/api/auth/upload-avatar',
      fieldName: 'image',
      filePath: filePath,
      fields: {'email': email},
    );

    final avatarUrl = response['avatarUrl']?.toString() ?? '';
    if (avatarUrl.isNotEmpty) {
      await _sessionService.saveProfileImage(avatarUrl);
    }

    return avatarUrl;
  }
}
