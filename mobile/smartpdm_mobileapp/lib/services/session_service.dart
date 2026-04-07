import 'package:shared_preferences/shared_preferences.dart';

class SessionUser {
  final String token;
  final String userId;
  final String email;
  final String studentId;
  final String? avatarUrl;
  final bool isVerified;
  final String? role;

  const SessionUser({
    required this.token,
    required this.userId,
    required this.email,
    required this.studentId,
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
    bool isVerified = false,
    String? role,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('jwt_token', token);
    await prefs.setString('user_id', userId);
    await prefs.setString('user_email', email);
    await prefs.setString('user_student_id', studentId);
    await prefs.setBool('user_is_verified', isVerified);
    if (role != null && role.trim().isNotEmpty) {
      await prefs.setString('user_role', role);
    }
  }

  Future<SessionUser> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    return SessionUser(
      token: prefs.getString('jwt_token') ?? '',
      userId: prefs.getString('user_id') ?? '',
      email: prefs.getString('user_email') ?? '',
      studentId: prefs.getString('user_student_id') ?? '',
      avatarUrl: prefs.getString('user_profile_image'),
      isVerified: prefs.getBool('user_is_verified') ?? false,
      role: prefs.getString('user_role'),
    );
  }

  Future<void> saveProfileImage(String avatarUrl) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_profile_image', avatarUrl);
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

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
    await prefs.remove('user_id');
    await prefs.remove('user_email');
    await prefs.remove('user_student_id');
    await prefs.remove('user_first_name');
    await prefs.remove('user_last_name');
    await prefs.remove('user_profile_image');
    await prefs.remove('user_role');
  }
}
