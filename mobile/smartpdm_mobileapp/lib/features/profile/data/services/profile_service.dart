import 'dart:typed_data';

import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';

class ProfileService {
  ProfileService({ApiClient? apiClient, SessionService? sessionService})
    : _apiClient = apiClient ?? ApiClient(),
      _sessionService = sessionService ?? const SessionService();

  final ApiClient _apiClient;
  final SessionService _sessionService;

  Future<Map<String, dynamic>> fetchMyProfile() async {
    final response = await _apiClient.getObject('/api/profile/me');
    final profile = _extractProfile(response);
    await _cacheProfile(profile);
    return profile;
  }

  Future<Map<String, dynamic>> updateMyProfile({
    required Map<String, dynamic> payload,
  }) async {
    final response = await _apiClient.patchJson(
      '/api/profile/me',
      body: payload,
    );
    final profile = _extractProfile(response);
    await _cacheProfile(profile);
    return profile;
  }

  Future<String> uploadAvatar({
    String? filePath,
    Uint8List? bytes,
    String? fileName,
  }) async {
    final response = bytes != null
        ? await _apiClient.uploadBytes(
            '/api/auth/upload-avatar',
            fieldName: 'image',
            bytes: bytes,
            fileName: fileName ?? 'avatar.jpg',
          )
        : await _apiClient.uploadFile(
            '/api/auth/upload-avatar',
            fieldName: 'image',
            filePath: filePath ?? '',
          );

    final avatarUrl = response['avatarUrl']?.toString() ?? '';
    if (avatarUrl.isNotEmpty) {
      await _sessionService.saveProfileImage(avatarUrl);
    }

    return avatarUrl;
  }

  Map<String, dynamic> _extractProfile(Map<String, dynamic> response) {
    final rawProfile = response['profile'];
    if (rawProfile is Map<String, dynamic>) {
      return rawProfile;
    }
    return response;
  }

  Future<void> _cacheProfile(Map<String, dynamic> profile) async {
    final addressParts =
        [
              profile['street_address']?.toString().trim(),
              profile['subdivision']?.toString().trim(),
              profile['city']?.toString().trim(),
              profile['province']?.toString().trim(),
            ]
            .where((value) => value != null && value.isNotEmpty)
            .cast<String>()
            .toList();

    await _sessionService.saveProfileCache(
      firstName: profile['first_name']?.toString() ?? '',
      lastName: profile['last_name']?.toString() ?? '',
      email: profile['email']?.toString() ?? '',
      studentId: profile['student_id']?.toString() ?? '',
      course: profile['course_code']?.toString() ?? '',
      phone: profile['phone_number']?.toString() ?? '',
      address: addressParts.join(', '),
      avatarUrl: profile['avatar_url']?.toString() ?? '',
    );
  }
}
