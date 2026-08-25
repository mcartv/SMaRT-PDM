import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SessionUser {
  final String token;
  final String userId;
  final String email;
  final String studentId;
  final String firstName;
  final String lastName;
  final String? avatarUrl;
  final bool isVerified;
  final bool hasScholarAccess;
  final String? role;

  const SessionUser({
    required this.token,
    required this.userId,
    required this.email,
    required this.studentId,
    this.firstName = '',
    this.lastName = '',
    this.avatarUrl,
    this.isVerified = false,
    this.hasScholarAccess = false,
    this.role,
  });
}

class SessionService {
  const SessionService();

  static const String _jwtTokenKey = 'jwt_token';
  static const String _legacyAuthTokenKey = 'auth_token';

  static const String _userIdKey = 'user_id';
  static const String _userEmailKey = 'user_email';
  static const String _userStudentIdKey = 'user_student_id';
  static const String _userFirstNameKey = 'user_first_name';
  static const String _userLastNameKey = 'user_last_name';
  static const String _userProfileImageKey = 'user_profile_image';
  static const String _userIsVerifiedKey = 'user_is_verified';
  static const String _userHasScholarAccessKey = 'user_has_scholar_access';
  static const String _userRoleKey = 'user_role';

  static const String _userCourseKey = 'user_course';
  static const String _userPhoneKey = 'user_phone';
  static const String _userAddressKey = 'user_address';

  static const String _pushDeviceTokenKey = 'push_device_token';
  static const String _pushDevicePlatformKey = 'push_device_platform';

  Future<void> saveAuthSession({
    required String token,
    required String userId,
    required String email,
    required String studentId,
    String firstName = '',
    String lastName = '',
    bool isVerified = false,
    bool hasScholarAccess = false,
    String? role,
  }) async {
    final prefs = await SharedPreferences.getInstance();

    final cleanToken = token.trim();

    await prefs.setString(_jwtTokenKey, cleanToken);

    // Compatibility key, useful if any older file still reads "auth_token".
    await prefs.setString(_legacyAuthTokenKey, cleanToken);

    await prefs.setString(_userIdKey, userId.trim());
    await prefs.setString(_userEmailKey, email.trim());
    await prefs.setString(_userStudentIdKey, studentId.trim());

    await prefs.setString(_userFirstNameKey, firstName.trim());
    await prefs.setString(_userLastNameKey, lastName.trim());

    await prefs.setBool(_userIsVerifiedKey, isVerified);
    await prefs.setBool(_userHasScholarAccessKey, hasScholarAccess);

    if (role != null && role.trim().isNotEmpty) {
      await prefs.setString(_userRoleKey, role.trim());
    } else {
      await prefs.remove(_userRoleKey);
    }

    debugPrint('SESSION SAVED TOKEN EMPTY: ${cleanToken.isEmpty}');
    debugPrint('SESSION SAVED USER ID: $userId');
    debugPrint('SESSION SAVED STUDENT ID: $studentId');
  }

  Future<SessionUser> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();

    final token =
        (prefs.getString(_jwtTokenKey) ??
                prefs.getString(_legacyAuthTokenKey) ??
                '')
            .trim();

    debugPrint('SESSION READ TOKEN EMPTY: ${token.isEmpty}');

    return SessionUser(
      token: token,
      userId: prefs.getString(_userIdKey) ?? '',
      email: prefs.getString(_userEmailKey) ?? '',
      studentId: prefs.getString(_userStudentIdKey) ?? '',
      firstName: prefs.getString(_userFirstNameKey) ?? '',
      lastName: prefs.getString(_userLastNameKey) ?? '',
      avatarUrl: prefs.getString(_userProfileImageKey),
      isVerified: prefs.getBool(_userIsVerifiedKey) ?? false,
      hasScholarAccess: prefs.getBool(_userHasScholarAccessKey) ?? false,
      role: prefs.getString(_userRoleKey),
    );
  }

  Future<String> getToken() async {
    final session = await getCurrentUser();
    return session.token;
  }

  Future<void> saveProfileImage(String avatarUrl) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userProfileImageKey, avatarUrl.trim());
  }

  Future<void> saveProfileCache({
    String? firstName,
    String? lastName,
    String? email,
    String? studentId,
    String? course,
    String? phone,
    String? address,
    String? avatarUrl,
    bool? hasScholarAccess,
  }) async {
    final prefs = await SharedPreferences.getInstance();

    if (firstName != null) {
      await prefs.setString(_userFirstNameKey, firstName.trim());
    }

    if (lastName != null) {
      await prefs.setString(_userLastNameKey, lastName.trim());
    }

    if (email != null) {
      await prefs.setString(_userEmailKey, email.trim());
    }

    if (studentId != null) {
      await prefs.setString(_userStudentIdKey, studentId.trim());
    }

    if (course != null) {
      await prefs.setString(_userCourseKey, course.trim());
    }

    if (phone != null) {
      await prefs.setString(_userPhoneKey, phone.trim());
    }

    if (address != null) {
      await prefs.setString(_userAddressKey, address.trim());
    }

    if (avatarUrl != null) {
      await prefs.setString(_userProfileImageKey, avatarUrl.trim());
    }

    if (hasScholarAccess != null) {
      await prefs.setBool(_userHasScholarAccessKey, hasScholarAccess);
    }
  }

  Future<void> saveScholarAccess({required bool hasScholarAccess}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_userHasScholarAccessKey, hasScholarAccess);
  }

  Future<void> savePushDeviceToken({
    required String token,
    required String platform,
  }) async {
    final prefs = await SharedPreferences.getInstance();

    await prefs.setString(_pushDeviceTokenKey, token.trim());
    await prefs.setString(_pushDevicePlatformKey, platform.trim());
  }

  Future<Map<String, String?>> getPushDeviceToken() async {
    final prefs = await SharedPreferences.getInstance();

    return {
      'token': prefs.getString(_pushDeviceTokenKey),
      'platform': prefs.getString(_pushDevicePlatformKey),
    };
  }

  Future<bool> isSessionValid() async {
    final session = await getCurrentUser();
    final token = session.token.trim();

    if (token.isEmpty) return false;

    try {
      final parts = token.split('.');
      if (parts.length != 3) return false;

      final normalizedPayload = base64Url.normalize(parts[1]);
      final payloadText = utf8.decode(base64Url.decode(normalizedPayload));
      final decoded = jsonDecode(payloadText);

      if (decoded is! Map<String, dynamic>) return false;

      final exp = decoded['exp'];
      if (exp == null) return false;

      final expiry = exp is int ? exp : int.tryParse(exp.toString());
      if (expiry == null) return false;

      final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      return expiry > now;
    } catch (error) {
      debugPrint('SESSION VALIDATION ERROR: $error');
      return false;
    }
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();

    await prefs.remove(_jwtTokenKey);
    await prefs.remove(_legacyAuthTokenKey);

    await prefs.remove(_userIdKey);
    await prefs.remove(_userEmailKey);
    await prefs.remove(_userStudentIdKey);
    await prefs.remove(_userFirstNameKey);
    await prefs.remove(_userLastNameKey);
    await prefs.remove(_userProfileImageKey);
    await prefs.remove(_userRoleKey);
    await prefs.remove(_userIsVerifiedKey);
    await prefs.remove(_userHasScholarAccessKey);

    await prefs.remove(_userCourseKey);
    await prefs.remove(_userPhoneKey);
    await prefs.remove(_userAddressKey);

    await prefs.remove(_pushDeviceTokenKey);
    await prefs.remove(_pushDevicePlatformKey);

    debugPrint('SESSION CLEARED');
  }
}
