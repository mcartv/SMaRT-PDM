import 'dart:convert';

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
    this.role,
  });
}

class SessionService {
  const SessionService();

  Future<void> saveAuthSession({
    required String token,
    required String userId,
    required String email,
    required String studentId,
    String firstName = '',
    String lastName = '',
    bool isVerified = false,
    String? role,
  }) async {
    final prefs = await SharedPreferences.getInstance();

    await prefs.setString('jwt_token', token);
    await prefs.setString('user_id', userId);
    await prefs.setString('user_email', email);
    await prefs.setString('user_student_id', studentId);

    if (firstName.trim().isNotEmpty) {
      await prefs.setString('user_first_name', firstName.trim());
    }

    if (lastName.trim().isNotEmpty) {
      await prefs.setString('user_last_name', lastName.trim());
    }

    await prefs.setBool('user_is_verified', isVerified);

    if (role != null && role.trim().isNotEmpty) {
      await prefs.setString('user_role', role.trim());
    }
  }

  Future<SessionUser> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();

    return SessionUser(
      token: prefs.getString('jwt_token') ?? '',
      userId: prefs.getString('user_id') ?? '',
      email: prefs.getString('user_email') ?? '',
      studentId: prefs.getString('user_student_id') ?? '',
      firstName: prefs.getString('user_first_name') ?? '',
      lastName: prefs.getString('user_last_name') ?? '',
      avatarUrl: prefs.getString('user_profile_image'),
      isVerified: prefs.getBool('user_is_verified') ?? false,
      role: prefs.getString('user_role'),
    );
  }

  Future<void> saveProfileImage(String avatarUrl) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_profile_image', avatarUrl);
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
  }) async {
    final prefs = await SharedPreferences.getInstance();

    if (firstName != null) {
      await prefs.setString('user_first_name', firstName);
    }
    if (lastName != null) {
      await prefs.setString('user_last_name', lastName);
    }
    if (email != null) {
      await prefs.setString('user_email', email);
    }
    if (studentId != null) {
      await prefs.setString('user_student_id', studentId);
    }
    if (course != null) {
      await prefs.setString('user_course', course);
    }
    if (phone != null) {
      await prefs.setString('user_phone', phone);
    }
    if (address != null) {
      await prefs.setString('user_address', address);
    }
    if (avatarUrl != null) {
      await prefs.setString('user_profile_image', avatarUrl);
    }
  }

  Future<void> savePushDeviceToken({
    required String token,
    required String platform,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('push_device_token', token);
    await prefs.setString('push_device_platform', platform);
  }

  Future<Map<String, String?>> getPushDeviceToken() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      'token': prefs.getString('push_device_token'),
      'platform': prefs.getString('push_device_platform'),
    };
  }

  Future<bool> isSessionValid() async {
    final session = await getCurrentUser();

    if (session.token.isEmpty) return false;

    try {
      final parts = session.token.split('.');
      if (parts.length != 3) return false;

      final normalized = base64Url.normalize(parts[1]);
      final payload = utf8.decode(base64Url.decode(normalized));
      final decoded = jsonDecode(payload);

      if (decoded is! Map<String, dynamic>) return false;

      final exp = decoded['exp'];
      if (exp == null) return false;

      final expiry = exp is int ? exp : int.tryParse(exp.toString());
      if (expiry == null) return false;

      final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      return expiry > now;
    } catch (_) {
      return false;
    }
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();

    await prefs.remove('user_has_scholar_access');
    await prefs.remove('jwt_token');
    await prefs.remove('user_id');
    await prefs.remove('user_email');
    await prefs.remove('user_student_id');
    await prefs.remove('user_first_name');
    await prefs.remove('user_last_name');
    await prefs.remove('user_profile_image');
    await prefs.remove('user_role');
    await prefs.remove('user_is_verified');

    await prefs.remove('user_course');
    await prefs.remove('user_phone');
    await prefs.remove('user_address');

    await prefs.remove('push_device_token');
    await prefs.remove('push_device_platform');
  }
}