// SMaRT-PDM: Profile — profile service (mobile service); calls APIs or shared services and returns processed results.
import 'dart:typed_data';

import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';

class ProfileService {
  ProfileService({ApiClient? apiClient, SessionService? sessionService})
    : _apiClient = apiClient ?? ApiClient(),
      _sessionService = sessionService ?? const SessionService();

  final ApiClient _apiClient;
  final SessionService _sessionService;

  // fetchMyProfile: fetches and returns fetch my profile for the Profile flow.
  Future<Map<String, dynamic>> fetchMyProfile() async {
    final response = await _apiClient.getObject('/api/profile/me');
    final profile = _extractProfile(response);
    await _cacheProfile(profile);
    return profile;
  }

  // updateMyProfile: updates update my profile for the Profile flow.
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

  // hasSeenOnboarding: checks whether has seen onboarding for the Profile flow.
  Future<bool> hasSeenOnboarding() async {
    final response = await _apiClient.getObject('/api/profile/me/onboarding');
    return response['has_seen_onboarding'] == true;
  }

  // markOnboardingSeen: marks mark onboarding seen for the Profile flow.
  Future<void> markOnboardingSeen() async {
    await _apiClient.patchJson('/api/profile/me/onboarding', body: const {});
  }

  // uploadAvatar: uploads upload avatar for the Profile flow.
  Future<Map<String, dynamic>> uploadAvatar({
    String? filePath,
    Uint8List? bytes,
    String? fileName,
    String? contentType,
  }) async {
    final response = bytes != null
        ? await _apiClient.uploadBytes(
            '/api/auth/upload-avatar',
            fieldName: 'image',
            bytes: bytes,
            fileName: fileName ?? 'avatar.jpg',
            contentType: contentType,
          )
        : await _apiClient.uploadFile(
            '/api/auth/upload-avatar',
            fieldName: 'image',
            filePath: filePath ?? '',
          );

    final rawProfile = response['profile'];
    if (rawProfile is Map<String, dynamic>) {
      await _cacheProfile(rawProfile);
    }

    return response;
  }

  // _extractProfile: handles extract profile for the Profile flow.
  Map<String, dynamic> _extractProfile(Map<String, dynamic> response) {
    final rawProfile = response['profile'];
    if (rawProfile is Map<String, dynamic>) {
      return rawProfile;
    }
    return response;
  }

  // _cacheProfile: handles cache profile for the Profile flow.
  Future<void> _cacheProfile(Map<String, dynamic> profile) async {
    final section =
        (profile['section'] ?? profile['current_section'])?.toString().trim() ?? '';
    final addressParts =
        [
              profile['street_address']?.toString().trim(),
              profile['subdivision']?.toString().trim(),
              profile['barangay']?.toString().trim(),
              profile['city']?.toString().trim(),
              profile['province']?.toString().trim(),
              profile['zip_code']?.toString().trim(),
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
      section: section,
      phone: profile['phone_number']?.toString() ?? '',
      address: addressParts.join(', '),
      avatarUrl: profile['avatar_url']?.toString() ?? '',
      hasScholarAccess: profile['has_scholar_access'] == true,
    );
  }
}
